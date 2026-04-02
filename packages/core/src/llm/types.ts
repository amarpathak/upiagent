/**
 * LLM Module Types
 *
 * Configuration types for the LLM parser. These define how consumers
 * configure which LLM provider and model to use.
 */

/**
 * Supported LLM providers.
 *
 * Why support multiple providers?
 * - OpenAI: Most popular, best structured output support (function calling)
 * - Anthropic: Strong at following complex instructions, good for extraction
 *
 * In FDE work, clients often have existing provider contracts or compliance
 * requirements that dictate which LLM they can use. Supporting both means
 * your library works in more environments.
 */
export type LlmProvider = "openai" | "anthropic" | "gemini" | "openrouter";

/**
 * Configuration for the LLM parser.
 */
export interface LlmConfig {
  /** Which LLM provider to use */
  provider: LlmProvider;

  /** API key for the chosen provider */
  apiKey: string;

  /**
   * Specific model to use (required).
   * Examples: "gemini-2.0-flash" (Gemini), "gpt-4o-mini" (OpenAI),
   * "claude-sonnet-4-5-20250514" (Anthropic)
   *
   * Model must be explicitly chosen so consumers control cost, capability,
   * and version stability. No silent defaults.
   */
  model: string;

  /**
   * Temperature controls randomness in LLM output.
   * 0.0 = deterministic (same input → same output)
   * 1.0 = creative (same input → different outputs each time)
   *
   * For data extraction, we want 0 — we're not asking the LLM to be
   * creative, we're asking it to read and report facts. Higher temperature
   * increases the chance of hallucinated amounts or reference numbers.
   *
   * Default: 0
   */
  temperature?: number;
}
