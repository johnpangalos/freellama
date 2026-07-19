# freellama

Local LLM runner on Deno + llama.cpp. `src/cli.ts` is the entrypoint; runtime permissions are
centralized in `tasks.ts`.

## Commands

- `deno task check` — typecheck + lint + fmt check (run before pushing)
- `deno task test` — full test suite
- `deno task dev <args>` — run the CLI with scoped permissions

## Commits and pull requests

- Commit messages and PR titles follow Conventional Commits: `type(scope)?: summary` with types
  feat, fix, docs, refactor, perf, test, build, ci, chore, revert. Mark breaking changes with `!`
  (e.g. `feat!: ...`).
- PRs are squash-merged using the PR title as the commit message, and Release Please builds
  `CHANGELOG.md` from those titles — write titles that read well as user-facing changelog entries
  (CI rejects non-conventional titles).
- Never edit `CHANGELOG.md`, `version.txt`, or the `VERSION` constant in `src/cli.ts` by hand;
  Release Please maintains them.
