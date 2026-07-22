// llama-server subprocess lifecycle: spawn, wait for readiness, stop.

import { deadline, poll } from "@std/async";

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

function freePort(): number {
  const listener = Deno.listen({ hostname: "127.0.0.1", port: 0 });
  const port = (listener.addr as Deno.NetAddr).port;
  listener.close();
  return port;
}

const DEFAULT_READY_TIMEOUT_S = 180;

/**
 * Seconds to wait for llama-server to become ready, from
 * FREELLAMA_READY_TIMEOUT. Large models (tens of GB) can take longer than the
 * default 180 s to load from disk. Exported for tests.
 */
export function readyTimeoutSeconds(): number {
  const raw = Number(Deno.env.get("FREELLAMA_READY_TIMEOUT"));
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_READY_TIMEOUT_S;
}

export async function startLlamaServer(opts: StartOptions): Promise<LlamaServerHandle> {
  const port = freePort();
  const debug = Deno.env.get("FREELLAMA_DEBUG") === "1";
  const contextSize = opts.contextSize ?? Number(Deno.env.get("FREELLAMA_CTX") ?? 4096);
  const readyTimeoutS = readyTimeoutSeconds();

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
    ...(opts.extraArgs ?? Deno.env.get("FREELLAMA_SERVER_ARGS")?.split(" ").filter(Boolean) ?? []),
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
      { interval: 300, signal: AbortSignal.timeout(readyTimeoutS * 1000) },
    );
  } catch (err) {
    if (err instanceof DOMException && err.name === "TimeoutError") {
      proc.kill("SIGKILL");
      throw new Error(
        `llama-server did not become ready within ${readyTimeoutS}s. ` +
          `Large models can take longer to load; raise FREELLAMA_READY_TIMEOUT (seconds).`,
      );
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
