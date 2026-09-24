import { describe, it, expect } from "vitest";
import { CostTracker } from "../cost.js";

/**
 * Provider callback fixtures.
 *
 * These are the REAL `llmOutput` shapes each provider emits, not hand-authored
 * convenience objects. The previous version of this test asserted the OpenAI
 * shape for every provider, which is exactly the shape @langchain/anthropic
 * does NOT emit — so the test passed while production recorded zero tokens for
 * every Anthropic call, silently disabling the daily token cap.
 *
 * ANTHROPIC: @langchain/anthropic v1.5.8 `_generateNonStreaming` returns
 *   `{ generations, llmOutput: rest }` where `rest` is the raw Anthropic API
 *   response minus role/type. Verified against
 *   node_modules/@langchain/anthropic/dist/chat_models.js:955. The string
 *   "tokenUsage" does not appear anywhere in that package.
 *
 * OPENAI/GEMINI: LangChain normalises to `tokenUsage.promptTokens`.
 */
const ANTHROPIC_LLM_OUTPUT = {
  id: "msg_01XFDUDYJgAACzvnptvVoYEL",
  model: "claude-haiku-4-5-20251001",
  stop_reason: "end_turn" as const,
  stop_sequence: null,
  usage: {
    input_tokens: 100,
    output_tokens: 50,
  },
};

const OPENAI_LLM_OUTPUT = {
  tokenUsage: {
    promptTokens: 100,
    completionTokens: 50,
    totalTokens: 150,
  },
};

describe("CostTracker", () => {
  describe("asLangChainHandler", () => {
    it("returns a callback handler with handleLLMEnd method", () => {
      const tracker = new CostTracker({});
      const handler = tracker.asLangChainHandler();
      expect(handler).toHaveProperty("handleLLMEnd");
      expect(typeof handler.handleLLMEnd).toBe("function");
    });

    // This is the regression test for the leak. It fails against the old
    // implementation, which read only `llmOutput.tokenUsage`.
    it("records token usage from a real Anthropic response", async () => {
      const tracker = new CostTracker({});
      const handler = tracker.asLangChainHandler();

      await handler.handleLLMEnd({
        generations: [],
        llmOutput: ANTHROPIC_LLM_OUTPUT,
      });

      const usage = tracker.getUsage();
      expect(usage.inputTokens).toBe(100);
      expect(usage.outputTokens).toBe(50);
      // Anthropic sends no total — it must be derived, not defaulted to 0.
      expect(usage.totalTokens).toBe(150);
      expect(usage.callCount).toBe(1);
    });

    it("records token usage from a real OpenAI/Gemini response", async () => {
      const tracker = new CostTracker({});
      const handler = tracker.asLangChainHandler();

      await handler.handleLLMEnd({
        generations: [],
        llmOutput: OPENAI_LLM_OUTPUT,
      });

      const usage = tracker.getUsage();
      expect(usage.inputTokens).toBe(100);
      expect(usage.outputTokens).toBe(50);
      expect(usage.totalTokens).toBe(150);
      expect(usage.callCount).toBe(1);
    });

    it("accumulates across mixed providers", async () => {
      const tracker = new CostTracker({});
      const handler = tracker.asLangChainHandler();

      await handler.handleLLMEnd({ generations: [], llmOutput: ANTHROPIC_LLM_OUTPUT });
      await handler.handleLLMEnd({ generations: [], llmOutput: OPENAI_LLM_OUTPUT });

      const usage = tracker.getUsage();
      expect(usage.inputTokens).toBe(200);
      expect(usage.outputTokens).toBe(100);
      expect(usage.totalTokens).toBe(300);
      expect(usage.callCount).toBe(2);
    });

    it("bills a conservative estimate when usage is unreadable", async () => {
      const tracker = new CostTracker({});
      const handler = tracker.asLangChainHandler();

      // A future provider, or a shape change, that we cannot parse.
      await handler.handleLLMEnd({ generations: [], llmOutput: {} });

      const usage = tracker.getUsage();
      // Must NOT be zero: silent zero is what made the leak unmetered.
      expect(usage.totalTokens).toBe(
        CostTracker.UNMEASURED_INPUT_ESTIMATE + CostTracker.UNMEASURED_OUTPUT_ESTIMATE,
      );
      expect(usage.callCount).toBe(1);
    });

    it("counts unreadable calls toward the budget limit", async () => {
      const tracker = new CostTracker({ budgetTokens: 500 });
      const handler = tracker.asLangChainHandler();

      // An unmeasurable call must still be able to trip the budget, otherwise
      // an unparseable provider shape becomes an unbounded spend path.
      await expect(
        handler.handleLLMEnd({ generations: [], llmOutput: {} }),
      ).rejects.toThrow(/budget exceeded/i);
    });
  });
});
