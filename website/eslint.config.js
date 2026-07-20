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
      // indent/printWidth mirror the prettier settings (2-space indent, 80).
      "better-tailwindcss/enforce-consistent-line-wrapping": [
        "error",
        { indent: 2, printWidth: 80 },
      ],
      "better-tailwindcss/enforce-consistent-class-order": "error",
      "better-tailwindcss/enforce-consistent-variant-order": "error",
      "better-tailwindcss/no-duplicate-classes": "error",
      "better-tailwindcss/no-unnecessary-whitespace": "error",
      "better-tailwindcss/no-unknown-classes": "error",
    },
  },
];
