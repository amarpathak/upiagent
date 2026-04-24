import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/setup/cli.ts", "src/client.ts"],
  format: ["esm"],
  dts: true,
  sourcemap: true,
  clean: true,
  external: [
    "googleapis",
    "@langchain/core",
    "@langchain/openai",
    "@langchain/anthropic",
    "@langchain/google-genai",
    "zod",
    "qrcode",
    "html-to-text",
    "pg",
  ],
});
