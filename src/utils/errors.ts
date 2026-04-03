/**
 * Custom Error Classes
 *
 * Why not just use Error? Because consumers need to handle different
 * failure modes differently. A Gmail auth failure needs a different
 * response than an LLM rate limit.
 *
 * Pattern: All upiagent errors extend UpiAgentError, so consumers can
 * catch all library errors with a single `catch (e instanceof UpiAgentError)`,
 * or catch specific errors for fine-grained handling.
 *
 * FDE insight: In client deployments, you'll always be asked "what errors
 * can this throw and how should we handle them?" Custom error classes
 * make this answerable from the type system.
 */

/**
 * Base error for all upiagent errors.
 * Consumers can catch this to handle any library error.
 */
export class UpiAgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "UpiAgentError";
  }
}

/** Gmail API authentication failed — credentials may be expired or invalid */
export class GmailAuthError extends UpiAgentError {
  constructor(message: string) {
    super(message, "GMAIL_AUTH_ERROR");
    this.name = "GmailAuthError";
  }
}

/** Gmail API rate limit hit */
export class GmailRateLimitError extends UpiAgentError {
  constructor(message: string) {
    super(message, "GMAIL_RATE_LIMIT");
    this.name = "GmailRateLimitError";
  }
}

/** LLM API call failed (network error, invalid response, etc.) */
export class LlmError extends UpiAgentError {
  constructor(message: string) {
    super(message, "LLM_ERROR");
    this.name = "LlmError";
  }
}

/** LLM provider rate limit hit */
export class LlmRateLimitError extends UpiAgentError {
  constructor(
    message: string,
    public readonly retryAfterMs?: number,
  ) {
    super(message, "LLM_RATE_LIMIT");
    this.name = "LlmRateLimitError";
  }
}

/**
 * LLM cost budget exceeded.
 *
 * When the consumer sets a token/cost budget, this error fires
 * when usage exceeds it. Prevents runaway costs from bugs or
 * attack patterns that trigger excessive LLM calls.
 *
 * FDE must-know: Clients will ALWAYS ask about cost controls.
 * An uncapped LLM integration is a budget risk.
 */
export class LlmBudgetExceededError extends UpiAgentError {
  constructor(
    message: string,
    public readonly totalTokensUsed: number,
    public readonly budgetTokens: number,
  ) {
    super(message, "LLM_BUDGET_EXCEEDED");
    this.name = "LlmBudgetExceededError";
  }
}

/** Invalid configuration provided to @upiagent/core */
export class ConfigError extends UpiAgentError {
  constructor(message: string) {
    super(message, "CONFIG_ERROR");
    this.name = "ConfigError";
  }
}
