import { describe, it, expect } from "vitest";
import { CostTracker } from "../cost.js";

describe("CostTracker", () => {
  describe("asLangChainHandler", () => {
    it("returns a callback handler with handleLLMEnd method", () => {
      const tracker = new CostTracker({});
      const handler = tracker.asLangChainHandler();
      expect(handler).toHaveProperty("handleLLMEnd");
      expect(typeof handler.handleLLMEnd).toBe("function");
    });

    it("records token usage from LLM output", async () => {
      const tracker = new CostTracker({});
      const handler = tracker.asLangChainHandler();
      await handler.handleLLMEnd({
        generations: [],
        llmOutput: {
          tokenUsage: {
            promptTokens: 100,
            completionTokens: 50,
            totalTokens: 150,
          },
        },
      });
      const usage = tracker.getUsage();
      expect(usage.inputTokens).toBe(100);
      expect(usage.outputTokens).toBe(50);
      expect(usage.totalTokens).toBe(150);
      expect(usage.callCount).toBe(1);
    });

    it("accumulates across multiple calls", async () => {
      const tracker = new CostTracker({});
      const handler = tracker.asLangChainHandler();
      await handler.handleLLMEnd({
        generations: [],
        llmOutput: { tokenUsage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 } },
      });
      await handler.handleLLMEnd({
        generations: [],
        llmOutput: { tokenUsage: { promptTokens: 200, completionTokens: 100, totalTokens: 300 } },
      });
      const usage = tracker.getUsage();
      expect(usage.inputTokens).toBe(300);
      expect(usage.outputTokens).toBe(150);
      expect(usage.totalTokens).toBe(450);
      expect(usage.callCount).toBe(2);
    });

    it("handles missing tokenUsage gracefully", async () => {
      const tracker = new CostTracker({});
      const handler = tracker.asLangChainHandler();
      await handler.handleLLMEnd({ generations: [], llmOutput: {} });
      const usage = tracker.getUsage();
      expect(usage.callCount).toBe(0);
    });
  });
});
