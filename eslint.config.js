import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  // Global ignores — must be first in flat config
  {
    ignores: ["dist/", "node_modules/"],
  },
  // ESLint's recommended rules
  js.configs.recommended,
  // TypeScript parser and rules
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        Buffer: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
];
