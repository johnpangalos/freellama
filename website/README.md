# freellama website

Documentation site for [freellama](https://github.com/johnpangalos/freellama) — splash page plus CLI
reference. Built with React Router 7, [comp0](https://comp0.dev) headless components, and Tailwind
CSS v4. Every route is prerendered to static HTML at build time (`ssr: false` + `prerender`) and
deployed as
[Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/) — no
server runtime.

A standalone pnpm project, deliberately independent of the repo's Deno setup: deps live in
`package.json` and `pnpm-lock.yaml` here, and the root `deno.json` / `deno.lock` never see them.
Node and pnpm versions are pinned in the root `mise.toml`. The one Deno appearance is `deno fmt` as
the formatter (config in `deno.json` here), so the whole repo shares one formatting style.

Run these from `website/`:

```bash
pnpm install         # install dependencies
pnpm dev             # dev server at localhost:5173
pnpm check           # typecheck + lint + fmt:check + build + wrangler deploy --dry-run
pnpm run deploy      # build + wrangler deploy (requires Cloudflare auth: wrangler login)
                     # ("run" required: plain `pnpm deploy` is a pnpm built-in)
```
