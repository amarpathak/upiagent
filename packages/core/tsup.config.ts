import { defineConfig } from "tsup";

export default defineConfig({
  // Entry point — tsup starts here and follows all imports
  // Two entry points:
  // - index.ts → the library (import { verifyPayment } from '@upiagent/core')
  // - cli.ts → the CLI binary (npx upiagent setup)
  entry: ["src/index.ts", "src/setup/cli.ts"],

  // Output format — ESM only. We declared "type": "module" in package.json,
  // so we only need ESM. If you wanted to support older CommonJS consumers,
  // you'd add "cjs" here and add a "require" condition to package.json exports.
  format: ["esm"],

  // Generate .d.ts type declaration files alongside the JS output.
  // This is what gives consumers autocomplete and type checking.
  dts: true,

  // Source maps — helps consumers debug issues back to your source code
  sourcemap: true,

  // Clean the dist/ folder before each build — prevents stale files
  clean: true,

  // Don't bundle dependencies — they'll be installed separately by the consumer.
  // If we bundled them, consumers would get duplicate copies of langchain, zod, etc.
  // This is a critical distinction: apps bundle everything, libraries don't.
  external: [
    "googleapis",
    "@langchain/core",
    "@langchain/openai",
    "@langchain/anthropic",
    "@langchain/google-genai",
    "zod",
    "qrcode",
  ],
});
