// A fake llama-server used by the integration tests: accepts the same flags
// freellama passes to the real binary and mimics /health and /v1/chat/completions.

function argValue(flag: string): string | undefined {
  const i = Deno.args.indexOf(flag);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}

const port = Number(argValue("--port") ?? 8080);
const model = argValue("-m") ?? "unknown";

Deno.serve({ hostname: "127.0.0.1", port }, async (req) => {
  const url = new URL(req.url);
  if (url.pathname === "/health") return new Response('{"status":"ok"}');

  if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
    const body = await req.json() as { stream?: boolean; model?: string };
    const created = Math.floor(Date.now() / 1000);
    if (!body.stream) {
      return Response.json({
        id: "chatcmpl-fake",
        object: "chat.completion",
        created,
        model: body.model ?? model,
        choices: [{
          index: 0,
          message: { role: "assistant", content: "Hello world" },
          finish_reason: "stop",
        }],
        usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
      });
    }
    const chunk = (delta: object, finish: string | null) =>
      `data: ${
        JSON.stringify({
          id: "chatcmpl-fake",
          object: "chat.completion.chunk",
          created,
          model: body.model ?? model,
          choices: [{ index: 0, delta, finish_reason: finish }],
        })
      }\n\n`;
    const sse = chunk({ role: "assistant" }, null) +
      chunk({ content: "Hello" }, null) +
      chunk({ content: " world" }, null) +
      chunk({}, "stop") +
      "data: [DONE]\n\n";
    return new Response(sse, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  return new Response("not found", { status: 404 });
});
