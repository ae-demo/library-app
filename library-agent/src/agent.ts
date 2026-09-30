import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, stepCountIs, type LanguageModel, type ModelMessage } from "ai";
import type { TurnHooks } from "./tracing.js";
import { SYSTEM_PROMPT, MAX_ITERATIONS } from "./prompt.js";
import { tools } from "./tools.js";
import { type ModelSettings } from "./config.js";

// The model provider is chosen at RUNTIME from MODEL_API_FORMAT, never at
// build time — the org can switch its connection without a rebuild.
export function modelClient(
  { format, baseURL, apiKey, modelName, keyHeader, authScheme }: ModelSettings,
): LanguageModel {
  switch (format) {
    case "anthropic":
      return createAnthropic({
        baseURL,
        ...(keyHeader
          ? { apiKey: "unused", headers: { [keyHeader]: apiKey } } // SDK will not start without an apiKey
          : authScheme === "bearer"
            ? { authToken: apiKey } // Authorization: Bearer
            : { apiKey }), // x-api-key
      })(modelName);
    case "openai-compatible":
      return createOpenAICompatible({
        name: "model",
        baseURL,
        includeUsage: true, // a streamed turn reports usage only when asked
        // No apiKey under the override: this SDK sends Authorization only when
        // given one, so the key goes out once, under the named header.
        ...(keyHeader ? { headers: { [keyHeader]: apiKey } } : { apiKey }),
      })(modelName);
    default:
      throw new Error(`unsupported MODEL_API_FORMAT: ${format}`);
  }
}

export async function runTurn(messages: ModelMessage[], settings: ModelSettings, hooks: TurnHooks) {
  let failure: unknown;
  const result = streamText({
    model: modelClient(settings),
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_ITERATIONS),
    // A provider error arrives HERE, not as the rejection below.
    onError: ({ error }) => { failure ??= error; },
    // Opens and closes a span per model call and per tool call — "Tracing".
    ...hooks,
  });
  // Awaiting these drives the stream, every tool step included, to its end.
  const [text, steps, toolCalls, usage] = await Promise.all([
    result.text, result.steps, result.toolCalls, result.totalUsage,
  ]).catch((err: unknown) => { throw failure ?? err; });
  if (failure !== undefined) throw failure;
  return { text, steps, toolCalls, usage };
}
