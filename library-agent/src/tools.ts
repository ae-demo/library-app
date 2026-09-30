// GENERATED from specs/design/components/library-agent/agent.afm.md's
// `x-aep.tools.openapi[].allow` list, against the operations it names in
// specs/design/components/library-api/openapi.yaml. Only the allow-listed
// operations are generated as tools — listBooks, listMyLoans, addBook — and
// that list is the security boundary: never add an operation here that the
// document does not allow.

import { tool } from "ai";
import { z } from "zod";
import { config } from "./config.js";
import { callContext } from "./context.js";

// Shares one call() helper for every operation: joins the injected base
// address with `new URL` (never string concatenation), attaches the caller's
// credential out-of-band, and shapes the result defensively.
async function call(
  method: string,
  path: string,
  options: { query?: Record<string, unknown>; body?: unknown } = {},
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const base = config.libraryApiUrl ?? "";
  const url = new URL(path.replace(/^\//, ""), base.endsWith("/") ? base : `${base}/`);
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const { authorization } = callContext.getStore() ?? {};
  const headers: Record<string, string> = { accept: "application/json" };
  if (authorization) headers.authorization = authorization;
  if (options.body !== undefined) headers["content-type"] = "application/json";

  const response = await fetch(url, {
    method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { ok: response.ok, status: response.status, body };
}

export const tools = {
  // GET /books — search the catalog, every signed-in user
  listBooks: tool({
    description:
      "Search the catalog — every signed-in user. Use to find currently available books, or to look up a book by title, author or genre.",
    inputSchema: z.object({
      title: z.string().optional().describe("filter by title, partial match"),
      author: z.string().optional().describe("filter by author, partial match"),
      genre: z.string().optional().describe("filter by genre"),
      status: z
        .enum(["available", "on-loan"])
        .optional()
        .describe("filter by availability — use 'available' for suggestions"),
      limit: z.number().int().max(100).optional().describe("page size, defaults to 20"),
      offset: z.number().int().optional().describe("page offset, defaults to 0"),
    }),
    execute: ({ title, author, genre, status, limit, offset }) =>
      call("GET", "/books", { query: { title, author, genre, status, limit, offset } }),
  }),

  // GET /me/loans — the caller's own loans
  listMyLoans: tool({
    description:
      "The caller's own loans — never anyone else's. Use to answer a plain-language question about the signed-in member's borrowed books.",
    inputSchema: z.object({
      limit: z.number().int().max(100).optional().describe("page size, defaults to 20"),
      offset: z.number().int().optional().describe("page offset, defaults to 0"),
    }),
    execute: ({ limit, offset }) => call("GET", "/me/loans", { query: { limit, offset } }),
  }),

  // POST /books — add a book to the catalog
  addBook: tool({
    description:
      "Add a book to the catalog. Only call this after the librarian has explicitly confirmed the extracted details — never on an unconfirmed or blank extraction.",
    inputSchema: z.object({
      title: z.string().describe("the book's title"),
      author: z.string().describe("the book's author"),
      genre: z.string().describe("the book's genre"),
      description: z.string().optional().describe("a short description, omit when not confirmed"),
    }),
    execute: ({ title, author, genre, description }) =>
      call("POST", "/books", { body: { title, author, genre, description } }),
  }),
};
