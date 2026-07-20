import { fileURLToPath } from "node:url";
import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// The Deno workspace hoists node_modules to the repo root, outside Vite's
// default fs sandbox (it doesn't recognize deno.json workspaces).
const repoRoot = fileURLToPath(new URL("..", import.meta.url));

export default defineConfig({
	server: {
		fs: {
			allow: [repoRoot],
		},
	},
	plugins: [
		cloudflare({ viteEnvironment: { name: "ssr" } }),
		tailwindcss(),
		reactRouter(),
		tsconfigPaths(),
	],
});
