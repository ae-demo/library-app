import "./tracing.js"; // side effects only — must load before any model client is created
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { ModelMessage } from "ai";
import { config, missingEnv, modelSettings, ATTACHMENTS } from "./config.js";
import { runTurn } from "./agent.js";
import { traceTurn } from "./tracing.js";
import { callContext } from "./context.js";
import { ensureStore, isStoreReady, initStore, loadConversation, saveConversation } from "./store.js";

const BODY_CAP = 24 * 1024 * 1024;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(payload);
}

// Keep at most BODY_CAP. Past it, answer 413 ONCE and keep reading without
// keeping anything, so the client finishes sending and actually sees the 413
// — destroying the request or closing the socket mid-upload resets the
// connection and the caller gets a network error instead. Past twice the
// cap, stop draining and drop it. Resolves null when the request was
// refused.
function readBody(req: IncomingMessage, res: ServerResponse): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let over = false;
    const refuse = () => { over = true; chunks.length = 0; sendJson(res, 413, { error: "request too large" }); };
    if (Number(req.headers["content-length"] ?? 0) > BODY_CAP) refuse();
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > 2 * BODY_CAP) { req.destroy(); return; }
      if (over) return;
      if (size > BODY_CAP) { refuse(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(over ? null : Buffer.concat(chunks).toString("utf8")));
    req.on("error", () => resolve(null));
    req.on("close", () => { if (!req.complete) resolve(null); });
  });
}

type Attachment = { name: string; mediaType: string; data: string };

// The whole request vocabulary. A field outside it is refused, so a caller
// speaking a newer contract than this agent was built for hears so, instead
// of having the field silently ignored.
const BODY_FIELDS = new Set(["conversationId", "message", "attachments"]);

function validate(body: unknown): { conversationId?: string; message: string; attachments: Attachment[] } | { error: string } {
  const b = body as Record<string, unknown> | null | undefined;
  const unknown = Object.keys(b ?? {}).find((key) => !BODY_FIELDS.has(key));
  if (unknown) return { error: `unknown field: ${unknown}` };
  const message = typeof b?.message === "string" ? b.message.trim() : null;
  const attachments: Attachment[] = Array.isArray(b?.attachments) ? (b.attachments as Attachment[]) : [];
  const conversationId = typeof b?.conversationId === "string" ? b.conversationId : undefined;
  if (message === null) return { error: "expected { message: string }" };
  if (attachments.length > 0 && !ATTACHMENTS) return { error: "this agent does not accept attachments" };
  if (message === "" && attachments.length === 0) return { error: "expected a message or attachments" };
  if (ATTACHMENTS && attachments.length > ATTACHMENTS.maxFiles) return { error: `at most ${ATTACHMENTS.maxFiles} files per message` };
  let total = 0;
  for (const a of attachments) {
    if (typeof a?.name !== "string" || typeof a?.mediaType !== "string" || typeof a?.data !== "string") return { error: "each attachment needs name, mediaType and data" };
    if (!ATTACHMENTS!.types.includes(a.mediaType)) return { error: `${a.name}: this agent does not accept ${a.mediaType}` };
    const bytes = Buffer.byteLength(a.data, "base64");
    if (bytes > ATTACHMENTS!.maxFileSizeMB * 1024 * 1024) return { error: `${a.name}: larger than ${ATTACHMENTS!.maxFileSizeMB} MB` };
    total += bytes;
  }
  if (total > 15 * 1024 * 1024) return { error: "the files together are over 15 MB" };
  return { conversationId, message, attachments };
}

// Reads the AI SDK's APICallError body; returns null for anything else.
function guardrailBlock(err: unknown): { name: string; reason: string } | null {
  const body = (err as { responseBody?: string; data?: unknown })?.responseBody;
  if (!body) return null;
  try {
    const m = (JSON.parse(body) as { message?: { action?: string; interveningGuardrail?: string; actionReason?: string } })?.message;
    if (m?.action !== "GUARDRAIL_INTERVENED") return null;
    return { name: m.interveningGuardrail ?? "guardrail", reason: m.actionReason ?? "refused by policy" };
  } catch {
    return null;
  }
}

const genAiSystem = config.modelApiFormat === "openai-compatible" ? "openai" : "anthropic";

async function handleChat(req: IncomingMessage, res: ServerResponse, userId: string): Promise<void> {
  const raw = await readBody(req, res);
  if (raw === null) return; // already answered (413) or the connection died

  let parsedBody: unknown;
  try {
    parsedBody = raw ? JSON.parse(raw) : {};
  } catch {
    return sendJson(res, 400, { error: "expected { message: string }" });
  }

  const v = validate(parsedBody);
  if ("error" in v) return sendJson(res, 400, { error: v.error });
  const { message, attachments } = v;

  // 3. ensure the store is ready, then resolve the conversation for this user
  try {
    await ensureStore();
  } catch (err) {
    console.error("store not ready:", err);
    return sendJson(res, 500, { error: "internal error" });
  }

  let id: string;
  let history: ModelMessage[];
  if (v.conversationId) {
    const found = await loadConversation(v.conversationId, userId);
    if (found === null) return sendJson(res, 404, { error: "conversation not found" });
    id = v.conversationId;
    history = found;
  } else {
    id = randomUUID();
    history = [];
  }

  // 4. the user message: text plus one file part per attachment
  const userParts: Array<
    | { type: "text"; text: string }
    | { type: "file"; data: string; mediaType: string; filename: string }
  > = [
    ...(message ? [{ type: "text" as const, text: message }] : []),
    ...attachments.map((a) => ({ type: "file" as const, data: a.data, mediaType: a.mediaType, filename: a.name })),
  ];
  const user: ModelMessage = { role: "user", content: userParts };
  const full = [...history, user];

  const authorization = req.headers.authorization;

  try {
    const turn = await callContext.run({ authorization }, () =>
      traceTurn(
        { conversationId: id, model: config.modelName ?? "", system: genAiSystem, message },
        (hooks) => runTurn(full, modelSettings(), hooks),
      ),
    );

    // 6. store text, not files — each file part becomes a note naming it
    const storedParts: Array<{ type: "text"; text: string }> = userParts.map((p) =>
      p.type === "file" ? { type: "text", text: `[attached: ${p.filename} (${p.mediaType})]` } : p,
    );
    const stored: ModelMessage = { role: "user", content: storedParts };
    await saveConversation(id, userId, [...history, stored, ...turn.steps.flatMap((s) => s.response.messages)]);

    return sendJson(res, 200, { conversationId: id, text: turn.text, toolCalls: turn.toolCalls });
  } catch (err) {
    const g = guardrailBlock(err);
    if (g) return sendJson(res, 422, { error: g.reason, guardrail: g.name });

    // A provider rejecting a turn that carried files: say which files, in a
    // FIXED message. The provider body stays in the log — never forward it.
    const status = (err as { statusCode?: number })?.statusCode;
    if (attachments.length > 0 && (status === 400 || status === 413 || status === 415)) {
      console.error("model rejected attached files:", attachments.map((a) => `${a.name} (${a.mediaType})`), err);
      return sendJson(res, 422, { error: "the model could not read the attached file(s)", files: attachments.map((a) => a.name) });
    }
    console.error("chat turn failed:", err);
    return sendJson(res, 500, { error: "internal error" });
  }
}

function handleHealthz(_req: IncomingMessage, res: ServerResponse): void {
  const missing = missingEnv();
  const store = isStoreReady() ? "ready" : "initialising";
  if (missing.length > 0 || store !== "ready") {
    return sendJson(res, 503, { ok: false, missing, store });
  }
  return sendJson(res, 200, { ok: true });
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const { method, url } = req;

  if (method === "GET" && url === "/healthz") {
    return handleHealthz(req, res);
  }

  if (method === "POST" && url === "/chat") {
    // Reject callers the gateway did not vouch for. x-user-id is injected by
    // the gateway from the caller's validated token; never parsed here.
    const userId = req.headers["x-user-id"];
    if (typeof userId !== "string" || userId === "") {
      res.statusCode = 401;
      res.end();
      return;
    }
    return handleChat(req, res, userId);
  }

  sendJson(res, 404, { error: "not found" });
}

const server = createServer();
server.on("request", (req, res) => {
  void handle(req, res).catch((err) => { // the last line of defence:
    console.error("chat turn failed:", err); // `void handle(...)` alone
    if (!res.headersSent) sendJson(res, 500, { error: "internal error" });
    else res.destroy(); // already streaming: cut it
  });
});

// Fire-and-forget: the DB may not be reachable yet at boot. /healthz reports
// the not-ready condition instead of the pod crash-looping.
initStore();

server.listen(config.port, () => {
  console.log(`library-agent listening on ${config.port}`);
});
