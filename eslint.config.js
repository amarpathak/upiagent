import js from "@eslint/js";

export default [
  // Global ignores — must be first in flat config
  {
    ignores: ["dist/", "node_modules/"],
  },
  // ESLint's recommended rules
  js.configs.recommended,
  {
    // ESLint doesn't know about .ts files by default — we must explicitly
    // tell it to process them. Without this, `eslint src/` silently ignores
    // every TypeScript file and then errors because "nothing matched."
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
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
