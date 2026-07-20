import tsParser from "@typescript-eslint/parser";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

export default [
	{
		ignores: [
			"build/",
			".react-router/",
			".wrangler/",
			"worker-configuration.d.ts",
		],
	},
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsParser,
			ecmaVersion: "latest",
			sourceType: "module",
		},
		plugins: {
			"better-tailwindcss": betterTailwindcss,
		},
		settings: {
			"better-tailwindcss": {
				entryPoint: "app/app.css",
			},
		},
		rules: {
			// Wrapped class lists live inside template literals, which deno fmt
			// leaves alone — indent/printWidth mirror the deno fmt settings.
			"better-tailwindcss/enforce-consistent-line-wrapping": [
				"error",
				{ indent: "tab", printWidth: 80 },
			],
			"better-tailwindcss/enforce-consistent-class-order": "error",
			"better-tailwindcss/enforce-consistent-variant-order": "error",
			"better-tailwindcss/no-duplicate-classes": "error",
			"better-tailwindcss/no-unnecessary-whitespace": "error",
			"better-tailwindcss/no-unknown-classes": "error",
		},
	},
];
