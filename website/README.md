# freellama website

Documentation site for [freellama](https://github.com/johnpangalos/freellama) —
splash page plus CLI reference. Built with React Router 7 (SSR),
[comp0](https://comp0.dev) headless components, and Tailwind CSS v4, deployed as
a Cloudflare Worker.

Managed with pnpm, independent of the Deno CLI at the repo root. Tool versions
(deno, node, pnpm) are pinned in the root `mise.toml`. The local `deno.json`
only configures `deno fmt` for this directory (tabs, line width 80) — run
`deno fmt` from `website/` to format; Tailwind class order/wrapping is enforced
by eslint (`pnpm lint:fix`, then `deno fmt`, then `pnpm lint`).

Run these from `website/`:

```bash
pnpm install         # install dependencies
pnpm dev             # dev server at localhost:5173
pnpm typecheck       # wrangler types + typegen + tsc
pnpm build           # production build
pnpm lint            # eslint (tailwind class order/wrapping)
pnpm deploy          # wrangler deploy (requires Cloudflare auth: wrangler login)
```
