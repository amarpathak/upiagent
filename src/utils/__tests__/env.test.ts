import { describe, it, expect } from "vitest";
import { validateGmailEnv, validateLlmEnv } from "../env.js";

describe("validateGmailEnv", () => {
  it("throws ConfigError when GMAIL_CLIENT_ID is missing", () => {
    expect(() => validateGmailEnv({})).toThrow("GMAIL_CLIENT_ID");
  });

  it("returns credentials when all vars present", () => {
    const env = {
      GMAIL_CLIENT_ID: "id",
      GMAIL_CLIENT_SECRET: "secret",
      GMAIL_REFRESH_TOKEN: "token",
    };
    const result = validateGmailEnv(env);
    expect(result).toEqual({
      clientId: "id",
      clientSecret: "secret",
      refreshToken: "token",
    });
  });
});

describe("validateLlmEnv", () => {
  it("throws ConfigError when no LLM key is set", () => {
    expect(() => validateLlmEnv({})).toThrow("LLM API key");
  });

  it("returns openai config when OPENAI_API_KEY is set", () => {
    const result = validateLlmEnv({ OPENAI_API_KEY: "sk-test" });
    expect(result.provider).toBe("openai");
    expect(result.apiKey).toBe("sk-test");
  });

  it("returns gemini config when GOOGLE_GENERATIVE_AI_API_KEY is set", () => {
    const result = validateLlmEnv({ GOOGLE_GENERATIVE_AI_API_KEY: "key" });
    expect(result.provider).toBe("gemini");
  });

  it("returns anthropic config when ANTHROPIC_API_KEY is set", () => {
    const result = validateLlmEnv({ ANTHROPIC_API_KEY: "key" });
    expect(result.provider).toBe("anthropic");
  });
});
