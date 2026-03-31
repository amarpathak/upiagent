/**
 * upiagent — UPI payment gateway via Gmail bank alert parsing
 *
 * Full payment flow: Generate QR → Customer pays → Verify via Gmail + LLM
 *
 * Usage:
 *   import { UpiAgent } from 'upiagent';
 *
 *   const agent = new UpiAgent({
 *     merchant: { upiId: 'shop@ybl', name: 'My Shop' },
 *     gmail: { clientId: '...', clientSecret: '...', refreshToken: '...' },
 *     llm: { provider: 'openai', apiKey: '...' },
 *   });
 *
 *   // Step 1: Create payment QR
 *   const payment = await agent.createPayment({ amount: 499, note: 'Order #123' });
 *   // → Show payment.qrDataUrl to customer
 *
 *   // Step 2: Verify payment (after customer pays)
 *   const result = await agent.verifyPayment({ expectedAmount: 499 });
 *   // → result.verified === true if payment found
 */

export const VERSION = "0.1.0";

// Main agent — the primary API consumers use
export { UpiAgent, type UpiAgentConfig } from "./agent.js";

// Payment — QR code generation and UPI intent URLs
export { createPayment, createPaymentSvg } from "./payment/index.js";
export { buildUpiIntentUrl, generateTransactionId } from "./payment/index.js";
export type { MerchantConfig, CreatePaymentOptions, PaymentRequest } from "./payment/index.js";

// Gmail adapter — fetch bank alert emails
export { GmailClient } from "./gmail/index.js";
export type { GmailCredentials, EmailMessage, GmailSearchOptions } from "./gmail/index.js";

// LLM parser — extract structured payment data from emails
export { parsePaymentEmail, createPaymentExtractionChain } from "./llm/index.js";
export { parsedPaymentSchema, type ParsedPayment } from "./llm/index.js";
export type { LlmConfig, LlmProvider } from "./llm/index.js";

// Security — 4-layer validation pipeline
export { SecurityValidator } from "./security/index.js";
export { InMemoryDedupStore, type DedupStore } from "./security/index.js";
export type {
  SecurityConfig,
  VerificationRequest,
  VerificationResult,
  ValidationFailureReason,
} from "./security/index.js";

// Utilities — logging, errors, retry, cost tracking
export { Logger, type LogLevel, type LogHandler } from "./utils/index.js";
export { CostTracker } from "./utils/index.js";
export { withRetry } from "./utils/index.js";
export {
  UpiAgentError,
  GmailAuthError,
  GmailRateLimitError,
  LlmError,
  LlmRateLimitError,
  LlmBudgetExceededError,
  ConfigError,
} from "./utils/index.js";

// Setup — Gmail OAuth flow helper
export { setupGmailAuth, type GmailAuthResult, type GmailAuthSetupOptions } from "./setup/index.js";
