// Minimal OpenAI-style chat client used by the `run` REPL to talk to llama-server.

import { TextLineStream } from "@std/streams";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StreamResult {
  content: string;
  finishReason: string | undefined;
}

/**
 * POST /v1/chat/completions with stream:true and invoke onDelta per content chunk.
 * Returns the full accumulated response.
 */
export async function streamChat(
  baseUrl: string,
  model: string,
  messages: ChatMessage[],
  onDelta: (text: string) => void,
  signal?: AbortSignal,
): Promise<StreamResult> {
  const resp = await fetch(`${baseUrl}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });
  if (!resp.ok || !resp.body) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Chat request failed: HTTP ${resp.status} ${body.slice(0, 500)}`);
  }

  let content = "";
  let finishReason: string | undefined;
  const lines = resp.body
    .pipeThrough(new TextDecoderStream())
    .pipeThrough(new TextLineStream());
  try {
    for await (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") break;
      const parsed = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string }; finish_reason?: string | null }>;
      };
      const choice = parsed.choices?.[0];
      if (choice?.delta?.content) {
        content += choice.delta.content;
        onDelta(choice.delta.content);
      }
      if (choice?.finish_reason) finishReason = choice.finish_reason;
    }
  } catch (err) {
    if (signal?.aborted) return { content, finishReason: "abort" };
    throw err;
  }
  return { content, finishReason };
}
