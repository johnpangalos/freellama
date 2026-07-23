# Changelog

## [0.1.5](https://github.com/johnpangalos/freellama/compare/v0.1.4...v0.1.5) (2026-07-23)


### Features

* **website:** rewrite in Astro on the Deno toolchain, deploy via GitHub Actions ([#38](https://github.com/johnpangalos/freellama/issues/38)) ([de061e2](https://github.com/johnpangalos/freellama/commit/de061e2ecceef03df09295ecbdde5f1c6cd53cfe))


### Bug Fixes

* **deps:** update dependency astro to v7.1.2 ([#48](https://github.com/johnpangalos/freellama/issues/48)) ([18bce79](https://github.com/johnpangalos/freellama/commit/18bce7912176819d1c8441403836909c43c1c8ad))
* **deps:** update dependency astro to v7.1.3 ([#49](https://github.com/johnpangalos/freellama/issues/49)) ([f7c2609](https://github.com/johnpangalos/freellama/commit/f7c2609d0b7158647d509bd862faf74d4181fb08))
* **deps:** update dependency typescript to v7 ([#30](https://github.com/johnpangalos/freellama/issues/30)) ([581fcea](https://github.com/johnpangalos/freellama/commit/581fceab9cd282a487ae47010a4fe61197cc3587))
* **website:** install wrangler via Deno to unbreak Cloudflare deploys ([#46](https://github.com/johnpangalos/freellama/issues/46)) ([351aaf3](https://github.com/johnpangalos/freellama/commit/351aaf322104e66cda71b87679ea938c46243759))

## [0.1.4](https://github.com/johnpangalos/freellama/compare/v0.1.3...v0.1.4) (2026-07-20)


### Features

* support split (multi-part) GGUF models ([#33](https://github.com/johnpangalos/freellama/issues/33)) ([4c55f06](https://github.com/johnpangalos/freellama/commit/4c55f0693beb7c3a3ab4ec637e9a78e5a7ae6ce9))
* **website:** prerender pages and add security headers ([#31](https://github.com/johnpangalos/freellama/issues/31)) ([5a2fc50](https://github.com/johnpangalos/freellama/commit/5a2fc50d93ede8424b60762eab86a9793e49b287))


### Bug Fixes

* **website:** sync pnpm lockfile with react-refresh 0.18.0 ([#34](https://github.com/johnpangalos/freellama/issues/34)) ([d391ad1](https://github.com/johnpangalos/freellama/commit/d391ad1b9d061d747cd397c15f5c8d9cdc5dff72))

## [0.1.3](https://github.com/johnpangalos/freellama/compare/v0.1.2...v0.1.3) (2026-07-20)


### Bug Fixes

* **ci:** publish releases as drafts until binaries are attached ([#22](https://github.com/johnpangalos/freellama/issues/22)) ([e2a9d2f](https://github.com/johnpangalos/freellama/commit/e2a9d2fb7b87838fb8e7b79693dd24f7252e95c0))
* **website:** repair Workers Builds deploy and upgrade to vite 8 ([#26](https://github.com/johnpangalos/freellama/issues/26)) ([54bc54a](https://github.com/johnpangalos/freellama/commit/54bc54a89ee399e35eaff5214cd887f407da7650))

## [0.1.2](https://github.com/johnpangalos/freellama/compare/v0.1.1...v0.1.2) (2026-07-20)


### Features

* add documentation website ([#14](https://github.com/johnpangalos/freellama/issues/14)) ([62b7754](https://github.com/johnpangalos/freellama/commit/62b775484d10aeb19c5a29a38ee605a444e2e6f3))


### Bug Fixes

* **website:** rename Worker to freellama so Workers Builds can deploy ([#21](https://github.com/johnpangalos/freellama/issues/21)) ([4ad66db](https://github.com/johnpangalos/freellama/commit/4ad66db778cf8bf7de190401e961f633179bb835))

## [0.1.1](https://github.com/johnpangalos/freellama/compare/v0.1.0...v0.1.1) (2026-07-19)


### Features

* initial freellama CLI — pull, run, list, rm, and an OpenAI-compatible serve, powered by llama.cpp ([2ad8ae8](https://github.com/johnpangalos/freellama/commit/2ad8ae8ef436eb1da99c5568a06e0e4152b9910d))
