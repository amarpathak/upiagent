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
  /**
   * Conservative fallback charge when a provider reports no usage we can read.
   * Sized above a typical payment-email parse (~500-800 tokens total) so an
   * unreadable provider shape errs toward over-billing rather than free usage.
   */
  static readonly UNMEASURED_INPUT_ESTIMATE = 1_000;
  static readonly UNMEASURED_OUTPUT_ESTIMATE = 200;

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

  /**
   * Returns a LangChain-compatible callback handler that captures token usage.
   *
   * LangChain's withStructuredOutput() doesn't expose token counts automatically —
   * you need to hook into the callback system. This method returns a handler
   * that fits the LangChain callback interface and pipes token data into record().
   *
   * Usage:
   *   const tracker = new CostTracker({ budgetTokens: 10_000 });
   *   const chain = createPaymentExtractionChain(config, {
   *     callbacks: [tracker.asLangChainHandler()]
   *   });
   */
  asLangChainHandler(): {
    handleLLMEnd: (output: {
      generations: unknown[];
      llmOutput?: {
        /** Anthropic (@langchain/anthropic v1.x) — raw API response passthrough */
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
        };
        /** OpenAI / Gemini — LangChain's normalised shape */
        tokenUsage?: {
          promptTokens?: number;
          completionTokens?: number;
          totalTokens?: number;
        };
      };
    }) => Promise<void>;
  } {
    return {
      handleLLMEnd: async (output) => {
        // Providers disagree on shape. @langchain/anthropic v1.x returns
        // `llmOutput: rest` — the raw Anthropic response, carrying
        // `usage.input_tokens`. OpenAI and Gemini emit LangChain's normalised
        // `tokenUsage.promptTokens`. Reading only the latter silently recorded
        // zero for every Anthropic call, which disabled the daily token cap.
        const anthropic = output.llmOutput?.usage;
        const normalized = output.llmOutput?.tokenUsage;

        const inputTokens = anthropic?.input_tokens ?? normalized?.promptTokens;
        const outputTokens = anthropic?.output_tokens ?? normalized?.completionTokens;

        if (inputTokens === undefined && outputTokens === undefined) {
          // A call completed but reported no usage we recognise. Booking zero
          // here is what turned a field-name mismatch into an unmetered spend
          // path, so charge a conservative estimate instead and make the gap
          // loud. "Could not measure" must never mean "was free".
          this.logger?.error(
            "LLM call reported no recognisable token usage — billing a conservative estimate",
            { llmOutput: output.llmOutput },
          );
          this.record({
            inputTokens: CostTracker.UNMEASURED_INPUT_ESTIMATE,
            outputTokens: CostTracker.UNMEASURED_OUTPUT_ESTIMATE,
            totalTokens:
              CostTracker.UNMEASURED_INPUT_ESTIMATE +
              CostTracker.UNMEASURED_OUTPUT_ESTIMATE,
          });
          return;
        }

        const input = inputTokens ?? 0;
        const output_ = outputTokens ?? 0;

        this.record({
          inputTokens: input,
          outputTokens: output_,
          // Anthropic sends no total; derive it rather than defaulting to 0.
          totalTokens: normalized?.totalTokens ?? input + output_,
        });
      },
    };
  }
}
