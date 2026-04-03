/**
 * Environment variable validation utilities.
 *
 * Provides clear, actionable error messages when required
 * configuration is missing — better DX than cryptic runtime failures.
 */

import { ConfigError } from "./errors.js";
import type { GmailCredentials } from "../gmail/types.js";
import type { LlmConfig, LlmProvider } from "../llm/types.js";

/**
 * Validate and return Gmail credentials from environment variables.
 * Throws ConfigError with a clear message if any required var is missing.
 *
 * @param env - Object to read env vars from (defaults to process.env)
 */
export function validateGmailEnv(
  env: Record<string, string | undefined> = process.env,
): GmailCredentials {
  const clientId = env.GMAIL_CLIENT_ID;
  const clientSecret = env.GMAIL_CLIENT_SECRET;
  const refreshToken = env.GMAIL_REFRESH_TOKEN;

  const missing: string[] = [];
  if (!clientId) missing.push("GMAIL_CLIENT_ID");
  if (!clientSecret) missing.push("GMAIL_CLIENT_SECRET");
  if (!refreshToken) missing.push("GMAIL_REFRESH_TOKEN");

  if (missing.length > 0) {
    throw new ConfigError(
      `Missing required Gmail environment variables: ${missing.join(", ")}. ` +
        `Run \`npx upiagent setup\` to configure Gmail OAuth credentials.`,
    );
  }

  return { clientId: clientId!, clientSecret: clientSecret!, refreshToken: refreshToken! };
}

/** Default models per provider */
const DEFAULT_MODELS: Record<string, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-5-20250514",
  gemini: "gemini-2.0-flash",
  openrouter: "openai/gpt-4o-mini",
};

/**
 * Auto-detect LLM provider from environment variables.
 * Checks keys in order: OpenAI, Anthropic, Gemini, OpenRouter.
 * Throws ConfigError if no LLM API key is found.
 *
 * @param env - Object to read env vars from (defaults to process.env)
 */
export function validateLlmEnv(
  env: Record<string, string | undefined> = process.env,
): LlmConfig {
  const checks: { key: string; provider: LlmProvider }[] = [
    { key: "OPENAI_API_KEY", provider: "openai" },
    { key: "ANTHROPIC_API_KEY", provider: "anthropic" },
    { key: "GOOGLE_GENERATIVE_AI_API_KEY", provider: "gemini" },
    { key: "OPENROUTER_API_KEY", provider: "openrouter" },
  ];

  for (const { key, provider } of checks) {
    const value = env[key];
    if (value) {
      return {
        provider,
        apiKey: value,
        model: DEFAULT_MODELS[provider]!,
      };
    }
  }

  throw new ConfigError(
    `No LLM API key found. Set one of: ${checks.map((c) => c.key).join(", ")}. ` +
      `See https://github.com/amarpathak/upiagent#configuration for details.`,
  );
}
