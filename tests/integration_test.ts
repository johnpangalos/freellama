// End-to-end tests against a fake llama-server (tests/fake_llama_server.ts):
// exercises the runner lifecycle, the streaming client, the `run` one-shot path,
// and the `serve` proxy — everything except real inference.

import { join } from "node:path";
import { poll } from "@std/async";
import { startLlamaServer } from "../src/lib/runner.ts";
import { streamChat } from "../src/lib/openai.ts";

const projectRoot = new URL("..", import.meta.url).pathname;

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function makeFixture(): Promise<{ home: string; wrapper: string; modelName: string }> {
  const home = await Deno.makeTempDir({ prefix: "freellama-test-" });

  // Wrapper script that stands in for the real llama-server binary.
  const wrapper = join(home, "fake-llama-server.sh");
  const fakeServer = join(projectRoot, "tests", "fake_llama_server.ts");
  await Deno.writeTextFile(
    wrapper,
    `#!/bin/sh\nexec "${Deno.execPath()}" run -A "${fakeServer}" "$@"\n`,
  );
  await Deno.chmod(wrapper, 0o755);

  // A dummy installed model.
  const modelName = "fake/model-GGUF:Q4_K_M";
  const modelFile = join(home, "models", "fake__model-GGUF__model-Q4_K_M.gguf");
  await Deno.mkdir(join(home, "models"), { recursive: true });
  await Deno.writeTextFile(modelFile, "not really a gguf");
  await Deno.writeTextFile(
    join(home, "manifest.json"),
    JSON.stringify({
      models: {
        [modelName]: {
          uri: `hf:${modelName}`,
          file: modelFile,
          sizeBytes: 17,
          pulledAt: "2026-07-19T00:00:00.000Z",
        },
      },
    }),
  );
  return { home, wrapper, modelName };
}

Deno.test("runner starts the server, streamChat streams, stop terminates", async () => {
  const { home, wrapper } = await makeFixture();
  try {
    const handle = await startLlamaServer({ serverBin: wrapper, modelPath: "fake.gguf" });
    const deltas: string[] = [];
    const result = await streamChat(
      handle.baseUrl,
      "fake",
      [{ role: "user", content: "hi" }],
      (d) => deltas.push(d),
    );
    assert(result.content === "Hello world", `unexpected content: ${result.content}`);
    assert(deltas.length >= 2, "expected multiple streamed deltas");
    assert(result.finishReason === "stop", `unexpected finish: ${result.finishReason}`);
    await handle.stop();
  } finally {
    await Deno.remove(home, { recursive: true });
  }
});

Deno.test("cli run one-shot prints the streamed response", async () => {
  const { home, wrapper, modelName } = await makeFixture();
  try {
    const out = await new Deno.Command(Deno.execPath(), {
      args: ["run", "-A", join(projectRoot, "src", "cli.ts"), "run", modelName, "hi there"],
      env: { FREELLAMA_HOME: home, FREELLAMA_LLAMA_SERVER: wrapper },
      stdout: "piped",
      stderr: "piped",
    }).output();
    const stdout = new TextDecoder().decode(out.stdout);
    assert(out.code === 0, `run exited ${out.code}: ${new TextDecoder().decode(out.stderr)}`);
    assert(stdout.includes("Hello world"), `stdout was: ${stdout}`);
  } finally {
    await Deno.remove(home, { recursive: true });
  }
});

Deno.test("serve proxies /v1/models and /v1/chat/completions (json + sse)", async () => {
  const { home, wrapper, modelName } = await makeFixture();
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();

  const proc = new Deno.Command(Deno.execPath(), {
    args: ["run", "-A", join(projectRoot, "src", "cli.ts"), "serve", "--port", String(port)],
    env: { FREELLAMA_HOME: home, FREELLAMA_LLAMA_SERVER: wrapper },
    stdout: "null",
    stderr: "null",
  }).spawn();

  const base = `http://127.0.0.1:${port}`;
  try {
    // Wait for the front server.
    await poll(
      async () => {
        try {
          const r = await fetch(`${base}/health`);
          await r.body?.cancel();
          return r.ok;
        } catch {
          return false; // Not up yet.
        }
      },
      (up) => up,
      { interval: 200, signal: AbortSignal.timeout(20_000) },
    );

    const models = await (await fetch(`${base}/v1/models`)).json();
    assert(models.data?.[0]?.id === modelName, `models response: ${JSON.stringify(models)}`);

    const completion = await (await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelName, messages: [{ role: "user", content: "hi" }] }),
    })).json();
    assert(
      completion.choices?.[0]?.message?.content === "Hello world",
      `completion: ${JSON.stringify(completion)}`,
    );
    assert(completion.usage?.total_tokens === 3, "usage passthrough");

    const sse = await (await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelName,
        messages: [{ role: "user", content: "hi" }],
        stream: true,
      }),
    })).text();
    assert(sse.includes('"Hello"'), `sse: ${sse}`);
    assert(sse.trimEnd().endsWith("data: [DONE]"), "sse must end with [DONE]");

    const missing = await fetch(`${base}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "nope/nope:Q0", messages: [] }),
    });
    assert(missing.status === 404, `expected 404, got ${missing.status}`);
    const err = await missing.json();
    assert(err.error?.code === "model_not_found", `error body: ${JSON.stringify(err)}`);
  } finally {
    proc.kill("SIGTERM");
    await proc.status;
    await Deno.remove(home, { recursive: true });
  }
});
