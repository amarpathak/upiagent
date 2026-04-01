// packages/core/src/llm/__tests__/chain.test.ts
import { describe, it, expect } from "vitest";
import { ConfigError } from "../../utils/errors.js";

// We need to test that createLlmModel throws ConfigError.
// But createLlmModel is not exported — it's called internally by createPaymentExtractionChain.
// So we test through createPaymentExtractionChain.
import { createPaymentExtractionChain } from "../chain.js";

describe("createPaymentExtractionChain", () => {
  it("throws ConfigError when model is not provided", () => {
    expect(() =>
      createPaymentExtractionChain({ provider: "gemini", apiKey: "test-key", model: "" } as any)
    ).toThrow(ConfigError);
  });

  it("error message includes example model names", () => {
    try {
      createPaymentExtractionChain({ provider: "gemini", apiKey: "test-key", model: "" } as any);
      expect.unreachable("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ConfigError);
      expect((e as Error).message).toContain("gemini-2.0-flash");
    }
  });
});
