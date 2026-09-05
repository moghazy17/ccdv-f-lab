import js from "@eslint/js";
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      "node_modules/",
      ".astro/",
      "dist/",
      "build/",
      "coverage/",
      "*.min.js",
      "playwright-report/",
      "test-results/"
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  ...astro.configs.recommended,
  {
    files: ["**/*.config.{js,mjs,ts}"],
    languageOptions: {
      globals: {
        process: "readonly",
        URL: "readonly",
        console: "readonly"
      }
    }
  }
];
