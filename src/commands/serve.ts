// OpenAI-compatible front server. Chat requests are reverse-proxied to a
// llama-server subprocess that is lazily started for the requested model.

import { parseArgs } from "@std/cli/parse-args";
import { status } from "../lib/util.ts";
import { getModel, listModels } from "../lib/store.ts";
import { ensureLlamaServer } from "../lib/backend.ts";
import { type LlamaServerHandle, startLlamaServer } from "../lib/runner.ts";

interface Backend {
  name: string;
  handle: LlamaServerHandle;
  /** Requests currently proxied to this backend (including streaming bodies). */
  inflight: number;
}

// How long a swap waits for in-flight requests to finish before stopping the
// old backend anyway (a stalled client must not wedge the server forever).
const DRAIN_TIMEOUT_MS = 30_000;

async function drain(backend: Backend): Promise<void> {
  const deadline = Date.now() + DRAIN_TIMEOUT_MS;
  while (backend.inflight > 0 && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (backend.inflight > 0) {
    status(
      `swap: ${backend.inflight} request(s) still active after drain timeout, stopping anyway`,
    );
  }
}

function openaiError(status: number, message: string, type: string, code?: string): Response {
  return Response.json({ error: { message, type, code: code ?? null } }, { status });
}

export async function serveCommand(args: string[]): Promise<void> {
  const flags = parseArgs(args, {
    string: ["host", "port"],
    default: { host: "127.0.0.1", port: "11434" },
  });
  const hostname = flags.host;
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
        status(`swapping model: ${backend.name} -> ${name}`);
        const old = backend;
        backend = null;
        // Let responses that are still streaming from the old backend finish
        // before killing it; new requests already see backend === null.
        await drain(old);
        await old.handle.stop();
      }
      status(`loading ${name}...`);
      const handle = await startLlamaServer({ serverBin, modelPath });
      status(`${name} ready`);
      backend = { name, handle, inflight: 0 };
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
          created: Math.floor(new Date(entry.pulledAt).getTime() / 1000) || 0,
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

      let tracked: Backend | undefined;
      const release = () => {
        if (tracked) {
          tracked.inflight--;
          tracked = undefined;
        }
      };
      try {
        const b = await backendFor(model.name, model.entry.file);
        // Count this request (until its body finishes streaming) so a model
        // swap drains it instead of killing the backend mid-response.
        b.inflight++;
        tracked = b;
        // Pass req.signal through so a client disconnect aborts generation.
        const upstream = await fetch(`${b.handle.baseUrl}/v1/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: rawBody,
          signal: req.signal,
        });
        const body = upstream.body?.pipeThrough(
          new TransformStream({ flush: release, cancel: release }),
        ) ?? null;
        if (!body) release();
        return new Response(body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
            "Cache-Control": "no-cache",
          },
        });
      } catch (err) {
        release();
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
      status(`freellama listening on http://${hostname}:${port}/v1`);
      status("point any OpenAI client at this base URL (any api key works)");
      if (hostname !== "127.0.0.1" && hostname !== "localhost") {
        status(
          `warning: serving on ${hostname} without authentication — anyone who can reach it can use your models`,
        );
      }
    },
  }, handler);

  const shutdown = async () => {
    status("\nshutting down...");
    await backend?.handle.stop();
    await server.shutdown();
    Deno.exit(0);
  };
  Deno.addSignalListener("SIGINT", shutdown);
  Deno.addSignalListener("SIGTERM", shutdown);

  await server.finished;
}
