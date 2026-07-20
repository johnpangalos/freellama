# freellama website

Documentation site for [freellama](https://github.com/johnpangalos/freellama) — splash page plus
CLI reference. Built with React Router 7 (SSR), [comp0](https://comp0.dev) headless components, and
Tailwind CSS v4, deployed as a Cloudflare Worker.

Managed with Deno (deps live in `package.json`; Deno installs them into `node_modules`).

```bash
deno install         # install dependencies
deno task dev        # dev server at localhost:5173
deno task typecheck  # typegen + tsc
deno task build      # production build
deno task deploy     # wrangler deploy (requires Cloudflare auth: wrangler login)
```
