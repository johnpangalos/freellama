// llama-server subprocess lifecycle: spawn, wait for readiness, stop.

import { deadline, poll } from "@std/async";
import { tokenizeArgs } from "./util.ts";

export interface LlamaServerHandle {
  port: number;
  baseUrl: string;
  pid: number;
  stop: () => Promise<void>;
}

export interface StartOptions {
  serverBin: string;
  modelPath: string;
  contextSize?: number;
  /** Extra raw llama-server flags, e.g. from FREELLAMA_SERVER_ARGS. */
  extraArgs?: string[];
}

/**
 * Default context window. Sized for agent use rather than chat: Claude Code's
 * system prompt alone runs 20–30k tokens, and the old 4096 default overflowed
 * before the first turn. The cost is KV-cache memory, which scales linearly
 * with this number — see the README for lowering it, or trading it for
 * --cache-type-k/--cache-type-v quantization.
 */
export const DEFAULT_CTX = 32768;

/**
 * Context size to run with: an explicit --ctx wins, then FREELLAMA_CTX, then
 * the default. 0 means "whatever context the model was trained for", which
 * llama-server reads from the GGUF metadata — convenient, but a model with a
 * 256k trained context will try to allocate a KV cache to match.
 */
export function resolveContextSize(explicit?: string): number {
  const raw = explicit ?? Deno.env.get("FREELLAMA_CTX");
  if (raw === undefined || raw === "") return DEFAULT_CTX;
  const size = Number(raw);
  if (!Number.isInteger(size) || size < 0) {
    throw new Error(
      `Invalid context size "${raw}" — expected a non-negative integer (0 = the model's trained context)`,
    );
  }
  return size;
}

function freePort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

const READY_TIMEOUT_MS = 180_000;

export async function startLlamaServer(opts: StartOptions): Promise<LlamaServerHandle> {
  const port = freePort();
  const debug = Deno.env.get("FREELLAMA_DEBUG") === "1";
  const contextSize = opts.contextSize ?? resolveContextSize();

  const args = [
    "-m",
    opts.modelPath,
    "--host",
    "127.0.0.1",
    "--port",
    String(port),
    "-c",
    String(contextSize),
    "--jinja",
    ...(opts.extraArgs ?? tokenizeArgs(Deno.env.get("FREELLAMA_SERVER_ARGS") ?? "")),
  ];

  const proc = new Deno.Command(opts.serverBin, {
    args,
    stdin: "null",
    stdout: debug ? "inherit" : "null",
    stderr: debug ? "inherit" : "null",
  }).spawn();

  let exited = false;
  const exitInfo = proc.status.then((status) => {
    exited = true;
    return status;
  });

  const baseUrl = `http://127.0.0.1:${port}`;
  try {
    await poll(
      async () => {
        if (exited) {
          const status = await exitInfo;
          throw new Error(
            `llama-server exited with code ${status.code} before becoming ready. ` +
              `Re-run with FREELLAMA_DEBUG=1 to see its output.`,
          );
        }
        try {
          const resp = await fetch(`${baseUrl}/health`);
          await resp.body?.cancel();
          return resp.ok;
        } catch {
          return false; // Not listening yet.
        }
      },
      (healthy) => healthy,
      { interval: 300, signal: AbortSignal.timeout(READY_TIMEOUT_MS) },
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      proc.kill("SIGKILL");
      throw new Error(`llama-server did not become ready within ${READY_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  }

  return {
    port,
    baseUrl,
    pid: proc.pid,
    stop: async () => {
      if (exited) return;
      try {
        proc.kill("SIGTERM");
      } catch {
        return;
      }
      try {
        await deadline(proc.status, 5000);
      } catch {
        // Didn't exit in time — escalate.
        try {
          proc.kill("SIGKILL");
        } catch {
          // Already gone.
        }
        await proc.status;
      }
    },
  };
}
