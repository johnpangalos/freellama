#!/usr/bin/env -S deno run --allow-read --allow-write --allow-net --allow-run --allow-env=FREELLAMA_CTX,FREELLAMA_DEBUG,FREELLAMA_HOME,FREELLAMA_LLAMA_SERVER,FREELLAMA_LLAMA_VERSION,FREELLAMA_SERVER_ARGS,GITHUB_TOKEN,HF_TOKEN,HOME,USERPROFILE
// freellama — run LLMs locally, powered by llama.cpp. See README.md for credits.
// The shebang above is the single source of truth for runtime permissions:
// tasks.ts parses it, so `./src/cli.ts`, deno task dev, compile, and install
// all run with the identical scoped flag set.

import { pullCommand } from "./commands/pull.ts";
import { listCommand } from "./commands/list.ts";
import { rmCommand } from "./commands/rm.ts";
import { runCommand } from "./commands/run.ts";
import { serveCommand } from "./commands/serve.ts";

const VERSION = "0.1.0"; // x-release-please-version

const HELP = `freellama ${VERSION} — run LLMs locally, powered by llama.cpp

Usage: freellama <command> [args]

Commands:
  pull <model>            Download a GGUF model from Hugging Face
                          e.g. freellama pull hf:Qwen/Qwen2.5-0.5B-Instruct-GGUF:Q4_K_M
  run <model> [prompt]    Chat with a model (REPL, or one-shot with a prompt)
  list | ls               List installed models
  rm <model>              Remove an installed model
  serve [--host H] [--port P]
                          Start an OpenAI-compatible server (default 127.0.0.1:11434)

Environment:
  FREELLAMA_HOME            Data directory (default ~/.freellama)
  FREELLAMA_CTX             Context size (default 4096)
  FREELLAMA_LLAMA_VERSION   Pin a llama.cpp release tag (default: latest)
  FREELLAMA_LLAMA_SERVER    Use an existing llama-server binary
  FREELLAMA_SERVER_ARGS     Extra flags passed to llama-server
  FREELLAMA_DEBUG=1         Show llama-server output
  HF_TOKEN                  Hugging Face token for gated models
`;

async function main() {
  const [command, ...rest] = Deno.args;
  switch (command) {
    case "pull":
      return await pullCommand(rest);
    case "run":
      return await runCommand(rest);
    case "list":
    case "ls":
      return await listCommand(rest);
    case "rm":
      return await rmCommand(rest);
    case "serve":
      return await serveCommand(rest);
    case "--version":
    case "-v":
      return console.log(`freellama ${VERSION}`);
    case undefined:
    case "help":
    case "--help":
    case "-h":
      return console.log(HELP);
    default:
      // Error path: help is diagnostic output here, keep stdout clean for pipes.
      console.error(`Unknown command: ${command}\n`);
      console.error(HELP);
      Deno.exit(1);
  }
}

try {
  await main();
} catch (err) {
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  Deno.exit(1);
}
