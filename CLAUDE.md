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
- `website/` is a standalone pnpm project, intentionally outside the Deno workspace/lockfile — never
  add it to `deno.json` `workspace` or let its deps into the root `deno.lock`. For website changes,
  `pnpm check` (from `website/`) must pass before committing.
- In JSX (`website/`), write markup as raw JSX. Don't build data structures (arrays/objects of
  content) that get `.map()`ed into elements — inline the elements directly, and share styling
  through small components that take `children`. Reserve `.map()` for genuinely dynamic data.
- Keep Tailwind classes inline in the JSX — no variables/constants holding class strings; repeat the
  string if two elements share it. Class order is enforced by eslint-plugin-better-tailwindcss
  (`pnpm lint` / `pnpm lint:fix` in `website/`); its line-wrapping rule stays off because `deno fmt`
  (the website's formatter too, via `pnpm fmt`) owns line layout.

## Commits and pull requests

- Commit messages and PR titles follow Conventional Commits: `type(scope)?: summary` with types
  feat, fix, docs, refactor, perf, test, build, ci, chore, revert. Mark breaking changes with `!`
  (e.g. `feat!: ...`).
- PRs are squash-merged using the PR title as the commit message, and Release Please builds
  `CHANGELOG.md` from those titles — write titles that read well as user-facing changelog entries
  (CI rejects non-conventional titles).
- Never edit `CHANGELOG.md`, `version.txt`, or `.release-please-manifest.json` by hand; Release
  Please maintains them. The manifest is the version's source of truth — `src/cli.ts` imports it.
