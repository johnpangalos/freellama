# freellama website

Documentation site for [freellama](https://github.com/johnpangalos/freellama) —
splash page plus CLI reference. Built with [Astro](https://astro.build) (static
output), React islands with [comp0](https://comp0.dev) headless components, and
Tailwind CSS v4, deployed to Cloudflare Workers as static assets.

A standalone Deno project, independent of the Deno CLI at the repo root: npm
dependencies are declared in `package.json` and locked by `deno.lock` (there is
no npm/pnpm lockfile). Formatting and linting are `deno fmt`/`deno lint`
(`.astro` files are not formatted; keep Tailwind class style consistent by
hand).

Run these from `website/`:

```bash
deno install --allow-scripts   # install dependencies
deno task dev                  # dev server at localhost:4321
deno task check                # astro check + deno lint + deno fmt --check
deno task build                # static build to dist/
deno task preview              # serve the production build
```

Deploys happen automatically on pushes to `main` that touch `website/` via
`.github/workflows/website-deploy.yml` (wrangler-action; needs the
`CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets). To deploy
manually: `deno task build`, then `npx wrangler deploy` from `website/` —
wrangler must run under Node, not Deno.
