// llama-server subprocess lifecycle: spawn, wait for readiness, stop.

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

const READY_TIMEOUT_MS = 180_000;

export async function startLlamaServer(opts: StartOptions): Promise<LlamaServerHandle> {
  const port = freePort();
  const debug = Deno.env.get("FREELLAMA_DEBUG") === "1";
  const contextSize = opts.contextSize ?? Number(Deno.env.get("FREELLAMA_CTX") ?? 4096);

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
  const deadline = Date.now() + READY_TIMEOUT_MS;
  let ready = false;
  while (Date.now() < deadline) {
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
      if (resp.ok) {
        ready = true;
        break;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  if (!ready) {
    proc.kill("SIGKILL");
    throw new Error(`llama-server did not become ready within ${READY_TIMEOUT_MS / 1000}s`);
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
      const killTimer = setTimeout(() => {
        try {
          proc.kill("SIGKILL");
        } catch {
          // Already gone.
        }
      }, 5000);
      await proc.status;
      clearTimeout(killTimer);
    },
  };
}
