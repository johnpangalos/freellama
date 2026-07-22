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
- In website markup (`.astro` files and React islands), write raw markup. Don't build data
  structures (arrays/objects of content) that get `.map()`ed into elements — inline the elements
  directly, and share styling through small components that take `children`/`<slot />`. Reserve
  `.map()` for genuinely dynamic data.
- Keep Tailwind classes inline in the markup — no variables/constants holding class strings; repeat
  the string if two elements share it. Nothing enforces class order or wrapping — match the
  surrounding style by hand. `deno fmt` formats `.ts`/`.tsx`/`.css` but not `.astro`.
- `website/` is an Astro site, a standalone Deno project (own `deno.json` + `deno.lock`; npm deps
  declared in its `package.json`, locked by `deno.lock` — there is no npm/pnpm lockfile), separate
  from the root Deno CLI and excluded from root `deno fmt`/`deno lint`. Run `deno task check` and
  `deno task build` from `website/`. Deploys go through `.github/workflows/website-deploy.yml`
  (Cloudflare Workers static assets via wrangler-action); wrangler cannot run under Deno — use
  `npx wrangler` if you need it locally.

## Commits and pull requests

- Commit messages and PR titles follow Conventional Commits: `type(scope)?: summary` with types
  feat, fix, docs, refactor, perf, test, build, ci, chore, revert. Mark breaking changes with `!`
  (e.g. `feat!: ...`).
- PRs are squash-merged using the PR title as the commit message, and Release Please builds
  `CHANGELOG.md` from those titles — write titles that read well as user-facing changelog entries
  (CI rejects non-conventional titles).
- Never edit `CHANGELOG.md`, `version.txt`, or `.release-please-manifest.json` by hand; Release
  Please maintains them. The manifest is the version's source of truth — `src/cli.ts` imports it.
