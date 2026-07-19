# freellama

Ollama-style CLI + OpenAI-compatible server for running LLMs locally via llama.cpp. Built with Deno
2.x. See README.md for commands and architecture.

## Guidelines

- Before implementing a utility (polling, path handling, stream splitting, assertions, retries, file
  walking, ...), check the Deno standard library first: https://jsr.io/@std. Prefer an existing
  `@std/*` API over hand-rolling; use `deno doc jsr:@std/<name>` to inspect a package's exports.
  Import via the `@std/*` entries in `deno.json`.
- Prefer `@std/path` over `node:path`.
- `deno task check` (type-check + lint + fmt) and `deno task test` must pass before committing.
