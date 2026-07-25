// A fake llama-server used by the integration tests: accepts the same flags
// freellama passes to the real binary and mimics /health, /v1/chat/completions
// and the Anthropic Messages API (/v1/messages, /v1/messages/count_tokens).

function argValue(flag: string): string | undefined {
  const i = Deno.args.indexOf(flag);
  return i >= 0 ? Deno.args[i + 1] : undefined;
}

const port = Number(argValue("--port") ?? 8080);
const model = argValue("-m") ?? "unknown";

// Lets a test assert on the flags freellama chose to spawn the backend with.
const argsFile = Deno.env.get("FAKE_LLAMA_ARGS_FILE");
if (argsFile) Deno.writeTextFileSync(argsFile, JSON.stringify(Deno.args));

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

  if (req.method === "POST" && url.pathname === "/v1/messages/count_tokens") {
    await req.json();
    // Echo a header back so the test can prove client headers reach the backend.
    return Response.json({
      input_tokens: 7,
      seen_anthropic_version: req.headers.get("anthropic-version"),
      seen_api_key: req.headers.get("x-api-key"),
    });
  }

  if (req.method === "POST" && url.pathname === "/v1/messages") {
    const body = await req.json() as { stream?: boolean; model?: string };
    const base = {
      id: "msg_fake",
      type: "message",
      role: "assistant",
      model: body.model ?? model,
      stop_reason: "end_turn",
      usage: { input_tokens: 1, output_tokens: 2 },
    };
    if (!body.stream) {
      return Response.json({ ...base, content: [{ type: "text", text: "Hello world" }] });
    }
    const event = (type: string, data: object) =>
      `event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`;
    const sse = event("message_start", { message: { ...base, content: [] } }) +
      event("content_block_start", {
        index: 0,
        content_block: { type: "text", text: "" },
      }) +
      event("content_block_delta", {
        index: 0,
        delta: { type: "text_delta", text: "Hello" },
      }) +
      event("content_block_delta", {
        index: 0,
        delta: { type: "text_delta", text: " world" },
      }) +
      event("content_block_stop", { index: 0 }) +
      event("message_delta", { delta: { stop_reason: "end_turn" } }) +
      event("message_stop", {});
    return new Response(sse, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
    });
  }

  return new Response("not found", { status: 404 });
});
