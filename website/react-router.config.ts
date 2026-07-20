import type { Config } from "@react-router/dev/config";

// Fully static site: every route is prerendered at build time and served as
// plain files from Cloudflare Workers static assets — no server runtime.
export default {
	ssr: false,
	prerender: ["/", "/docs"],
} satisfies Config;
