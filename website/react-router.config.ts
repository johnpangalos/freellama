import type { Config } from "@react-router/dev/config";

export default {
  ssr: true,
  // Prerendered routes are served as static assets without invoking the
  // Worker, so page floods can't burn Worker requests or CPU time.
  prerender: ["/", "/docs"],
  future: {
    v8_viteEnvironmentApi: true,
  },
} satisfies Config;
