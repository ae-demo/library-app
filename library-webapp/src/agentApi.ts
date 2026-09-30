// library-agent has no OpenAPI contract — it speaks the one fixed chat
// contract every platform agent speaks. It is an EXTRA sibling (library-api is
// the primary dependency, reached at /api), so it is reached same-origin at
// /api/library-agent/ (react-webapp's ai-agent-dependency section). Authorized
// through the same apiFetch/apiJson helpers as any other sibling call — no
// bearer attached by hand, no authorization logic of its own.

import { apiJson } from "./authz/client";

export interface ChatAttachment {
  name: string;
  mediaType: string;
  /** base64-encoded file contents. */
  data: string;
}

export interface ChatRequest {
  conversationId?: string;
  message: string;
  attachments?: ChatAttachment[];
}

export interface ChatResponse {
  conversationId: string;
  text: string;
  toolCalls: unknown[];
}

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  return apiJson<ChatResponse>("/library-agent/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
}
