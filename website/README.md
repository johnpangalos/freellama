# freellama website

Documentation site for [freellama](https://github.com/johnpangalos/freellama) — splash page plus CLI
reference. Built with React Router 7 (SSR), [comp0](https://comp0.dev) headless components, and
Tailwind CSS v4, deployed as a Cloudflare Worker.

A member of the repo's Deno workspace: deps live in `package.json`, are locked in the root
`deno.lock`, and `deno install` (from the repo root or here) puts them in `node_modules`. The Deno
version is pinned in the root `mise.toml`.

Run these from `website/`:

```bash
deno install         # install dependencies (workspace-wide)
deno task dev        # dev server at localhost:5173
deno task typecheck  # typegen + tsc
deno task build      # production build
deno task deploy     # wrangler deploy (requires Cloudflare auth: wrangler login)
```
