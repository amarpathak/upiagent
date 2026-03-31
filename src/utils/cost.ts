/**
 * LLM Token & Cost Tracker
 *
 * Every LLM call costs money. Without tracking, costs can spiral:
 * - A bug that retries infinitely → $100s in minutes
 * - A high-traffic endpoint calling LLM per request → surprise bill
 *
 * This tracker provides:
 * 1. Running totals of tokens used (input + output)
 * 2. Optional budget limits (hard stop when exceeded)
 * 3. Per-call logging for cost attribution
 *
 * FDE must-know: The first question a client CTO asks about any LLM
 * integration is "how much will this cost?" and "what prevents runaway costs?"
 * Having built-in cost tracking answers both.
 *
 * Approximate token costs (as of 2024):
 *   GPT-4o-mini:  ~$0.15/1M input,  ~$0.60/1M output
 *   GPT-4o:       ~$2.50/1M input,  ~$10/1M output
 *   Claude Sonnet: ~$3/1M input,    ~$15/1M output
 *
 * A single payment email parse ≈ 500-800 tokens total ≈ $0.0001-0.001
 */

import type { Logger } from "./logger.js";
import { LlmBudgetExceededError } from "./errors.js";

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface CostTrackerOptions {
  /** Maximum total tokens allowed. 0 = unlimited. */
  budgetTokens?: number;

  /** Logger for cost tracking events */
  logger?: Logger;
}

export class CostTracker {
  private totalInputTokens = 0;
  private totalOutputTokens = 0;
  private callCount = 0;
  private budgetTokens: number;
  private logger?: Logger;

  constructor(options: CostTrackerOptions = {}) {
    this.budgetTokens = options.budgetTokens ?? 0;
    this.logger = options.logger;
  }

  /**
   * Records token usage from an LLM call.
   * Throws LlmBudgetExceededError if budget is exceeded.
   */
  record(usage: TokenUsage): void {
    this.totalInputTokens += usage.inputTokens;
    this.totalOutputTokens += usage.outputTokens;
    this.callCount++;

    const totalUsed = this.totalInputTokens + this.totalOutputTokens;

    this.logger?.debug("LLM token usage recorded", {
      callNumber: this.callCount,
      callTokens: usage.totalTokens,
      totalTokensUsed: totalUsed,
      budgetTokens: this.budgetTokens || "unlimited",
    });

    if (this.budgetTokens > 0 && totalUsed > this.budgetTokens) {
      throw new LlmBudgetExceededError(
        `Token budget exceeded: used ${totalUsed}, budget ${this.budgetTokens}`,
        totalUsed,
        this.budgetTokens,
      );
    }
  }

  /** Get current usage summary */
  getUsage() {
    return {
      inputTokens: this.totalInputTokens,
      outputTokens: this.totalOutputTokens,
      totalTokens: this.totalInputTokens + this.totalOutputTokens,
      callCount: this.callCount,
    };
  }

  /** Reset all counters */
  reset(): void {
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.callCount = 0;
  }
}
