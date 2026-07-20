# freellama website

Documentation site for [freellama](https://github.com/johnpangalos/freellama) — splash page plus CLI
reference. Built with React Router 7 (SSR), [comp0](https://comp0.dev) headless components, and
Tailwind CSS v4, deployed as a Cloudflare Worker.

A member of the repo's Deno workspace: deps live in `package.json`, are locked in the root
`deno.lock`, and `deno install` (from the repo root or here) puts them in `node_modules`. Deno and
Node versions are pinned in the root `mise.toml`.

The scripts invoke the toolchain (Vite, wrangler, tsc) through `node` explicitly: running these Node
programs under Deno's compat layer breaks CommonJS `require` resolution against the hoisted
workspace `node_modules` store (dev-server transforms 500 and the site never hydrates). Deno stays
the package manager and task runner; Node runs the tools.

Run these from `website/`:

```bash
deno install         # install dependencies (workspace-wide)
deno task dev        # dev server at localhost:5173
deno task typecheck  # typegen + tsc
deno task build      # production build
deno task deploy     # wrangler deploy (requires Cloudflare auth: wrangler login)
```
