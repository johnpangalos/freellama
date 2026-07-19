// OpenAI-compatible front server. Chat requests are reverse-proxied to a
// llama-server subprocess that is lazily started for the requested model.

import { parseArgs } from "node:util";
import { getModel, listModels } from "../lib/store.ts";
import { ensureLlamaServer } from "../lib/backend.ts";
import { type LlamaServerHandle, startLlamaServer } from "../lib/runner.ts";

interface Backend {
  name: string;
  handle: LlamaServerHandle;
}

function openaiError(status: number, message: string, type: string, code?: string): Response {
  return Response.json({ error: { message, type, code: code ?? null } }, { status });
}

export async function serveCommand(args: string[]): Promise<void> {
  const { values: flags } = parseArgs({
    args,
    options: {
      host: { type: "string", default: "127.0.0.1" },
      port: { type: "string", default: "11434" },
    },
  });
  const hostname = flags.host as string;
  const port = Number(flags.port);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port "${flags.port}"`);
  }

  const serverBin = await ensureLlamaServer();

  let backend: Backend | null = null;
  // Serializes model loads/swaps so concurrent first requests don't race.
  let swapLock: Promise<unknown> = Promise.resolve();

  const backendFor = (name: string, modelPath: string): Promise<Backend> => {
    const acquire = swapLock.then(async () => {
      if (backend?.name === name) return backend;
      if (backend) {
        console.error(`swapping model: ${backend.name} -> ${name}`);
        await backend.handle.stop();
        backend = null;
      }
      console.error(`loading ${name}...`);
      const handle = await startLlamaServer({ serverBin, modelPath });
      console.error(`${name} ready`);
      backend = { name, handle };
      return backend;
    });
    swapLock = acquire.catch(() => {});
    return acquire;
  };

  const handler = async (req: Request): Promise<Response> => {
    const url = new URL(req.url);

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/health")) {
      return new Response("freellama is running\n");
    }

    if (req.method === "GET" && url.pathname === "/v1/models") {
      const models = await listModels();
      return Response.json({
        object: "list",
        data: models.map(({ name, entry }) => ({
          id: name,
          object: "model",
          created: Math.floor(new Date(entry.pulledAt).getTime() / 1000),
          owned_by: "library",
        })),
      });
    }

    if (req.method === "POST" && url.pathname === "/v1/chat/completions") {
      let body: { model?: string };
      let rawBody: string;
      try {
        rawBody = await req.text();
        body = JSON.parse(rawBody);
      } catch {
        return openaiError(400, "Invalid JSON body", "invalid_request_error");
      }
      if (!body.model) {
        return openaiError(400, "Missing required field: model", "invalid_request_error");
      }
      const model = await getModel(body.model);
      if (!model) {
        return openaiError(
          404,
          `Model "${body.model}" not found. Pull it first: freellama pull hf:${body.model}`,
          "invalid_request_error",
          "model_not_found",
        );
      }

      try {
        const b = await backendFor(model.name, model.entry.file);
        // Pass req.signal through so a client disconnect aborts generation.
        const upstream = await fetch(`${b.handle.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: rawBody,
          signal: req.signal,
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
            "Cache-Control": "no-cache",
          },
        });
      } catch (err) {
        if (req.signal.aborted) return new Response(null, { status: 499 });
        const message = err instanceof Error ? err.message : String(err);
        return openaiError(502, `llama.cpp backend error: ${message}`, "server_error");
      }
    }

    return openaiError(
      404,
      `Unknown route: ${req.method} ${url.pathname}`,
      "invalid_request_error",
    );
  };

  const server = Deno.serve({
    hostname,
    port,
    onListen: ({ hostname, port }) => {
      console.error(`freellama listening on http://${hostname}:${port}/v1`);
      console.error("point any OpenAI client at this base URL (any api key works)");
    },
  }, handler);

  const shutdown = async () => {
    console.error("\nshutting down...");
    await backend?.handle.stop();
    await server.shutdown();
    Deno.exit(0);
  };
  Deno.addSignalListener("SIGINT", shutdown);
  Deno.addSignalListener("SIGTERM", shutdown);

  await server.finished;
}
