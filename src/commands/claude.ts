// `freellama claude <model>` — run Claude Code against a local model.
//
// Everything the hybrid workflow needs in one command: the model is pulled if
// missing, a server is started (or an already-running one reused), and `claude`
// is launched with the environment that points it at the local model.

import { parseArgs } from "@std/cli/parse-args";
import { status } from "../lib/util.ts";
import { getModel } from "../lib/store.ts";
import { resolveContextSize } from "../lib/runner.ts";
import { DEFAULT_PORT, type FrontServer, startFrontServer } from "./serve.ts";
import { pullModel } from "./pull.ts";

const USAGE = "Usage: freellama claude [--ctx N] [--port P] <model> [-- claude args...]";

/** Whether a freellama server is already answering on this base URL. */
async function freellamaIsServing(baseUrl: string): Promise<boolean> {
  try {
    const resp = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) });
    const body = await resp.text();
    return resp.ok && body.includes("freellama is running");
  } catch {
    return false; // Nothing listening, or something that isn't us.
  }
}

export async function claudeCommand(args: string[]): Promise<void> {
  // stopEarly hands everything after the model name to Claude Code untouched,
  // so its own flags are never mistaken for freellama's.
  const flags = parseArgs(args, { string: ["ctx", "port"], stopEarly: true });
  const positional = flags._.map(String);
  const reference = positional[0];
  if (!reference) throw new Error(USAGE);
  // Both `freellama claude <model> --resume` and `... <model> -- --resume` work;
  // the separator is optional, and swallowed when present.
  const passthrough = positional.slice(1);
  if (passthrough[0] === "--") passthrough.shift();

  const contextSize = resolveContextSize(flags.ctx);
  const port = Number(flags.port ?? DEFAULT_PORT);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid port "${flags.port}"`);
  }

  let model = await getModel(reference);
  if (!model) {
    status(`model not found locally, pulling ${reference}...`);
    model = await pullModel(reference);
  }

  const baseUrl = `http://127.0.0.1:${port}`;
  let server: FrontServer | undefined;
  if (await freellamaIsServing(baseUrl)) {
    // Reuse it rather than loading a second copy of the weights alongside it.
    status(`reusing the freellama server on ${baseUrl}`);
  } else {
    try {
      server = await startFrontServer({ hostname: "127.0.0.1", port, contextSize });
    } catch (err) {
      if (err instanceof Deno.errors.AddrInUse) {
        throw new Error(
          `Port ${port} is in use by something that is not freellama. Pass --port to pick another.`,
        );
      }
      throw err;
    }
    status(`serving ${model.name} on ${baseUrl}`);
  }

  // The model is loaded lazily on the first request, so the first prompt of the
  // session pays for it. Say so rather than letting Claude Code look hung.
  status(`starting claude against ${model.name} (the first request loads the model)`);

  let child: Deno.ChildProcess;
  try {
    child = new Deno.Command("claude", {
      args: passthrough,
      env: {
        ANTHROPIC_BASE_URL: baseUrl,
        // No auth is enforced anywhere in this path; the value only has to exist.
        ANTHROPIC_API_KEY: "local",
        // Every tier resolves to the one model that is actually loaded, so
        // subagents and background tasks stay local too.
        ANTHROPIC_DEFAULT_OPUS_MODEL: model.name,
        ANTHROPIC_DEFAULT_SONNET_MODEL: model.name,
        ANTHROPIC_DEFAULT_HAIKU_MODEL: model.name,
        // This header changes per request, and llama.cpp keys its prompt cache
        // on the whole prefix — leaving it on can cost most of the throughput.
        CLAUDE_CODE_ATTRIBUTION_HEADER: "0",
      },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }).spawn();
  } catch (err) {
    await server?.stop();
    if (err instanceof Deno.errors.NotFound) {
      throw new Error(
        "`claude` was not found on PATH. Install Claude Code first: https://claude.com/claude-code",
      );
    }
    throw err;
  }

  // Ctrl+C is Claude Code's to handle (it interrupts a response); tearing the
  // server down here would kill the model out from under a live session.
  Deno.addSignalListener("SIGINT", () => {});

  const { code } = await child.status;
  await server?.stop();
  Deno.exit(code);
}
