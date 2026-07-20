import tsParser from "@typescript-eslint/parser";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";

export default [
	{
		ignores: ["build/", ".react-router/", ".wrangler/"],
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
			// enforce-consistent-line-wrapping stays off: deno fmt owns line layout,
			// and the two would fight over how long class attributes wrap.
			"better-tailwindcss/enforce-consistent-class-order": "error",
			"better-tailwindcss/enforce-consistent-variant-order": "error",
			"better-tailwindcss/no-duplicate-classes": "error",
			"better-tailwindcss/no-unnecessary-whitespace": "error",
			"better-tailwindcss/no-unknown-classes": "error",
		},
	},
];
