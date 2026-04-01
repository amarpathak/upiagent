/**
 * @upiagent/core — UPI payment verification via Gmail bank alert parsing
 *
 * Full payment flow: Generate QR → Customer pays → Verify via Gmail + LLM
 *
 * Usage:
 *   import { verifyPayment, fetchAndVerifyPayment, createPayment } from '@upiagent/core';
 *
 *   // Step 1: Create payment QR
 *   const payment = await createPayment({
 *     merchant: { upiId: 'shop@ybl', name: 'My Shop' },
 *     amount: 499,
 *     note: 'Order #123',
 *   });
 *   // → Show payment.qrDataUrl to customer
 *
 *   // Step 2: Verify payment (after customer pays)
 *   const result = await fetchAndVerifyPayment({
 *     gmail: { clientId: '...', clientSecret: '...', refreshToken: '...' },
 *     llm: { provider: 'gemini', model: 'gemini-2.0-flash', apiKey: '...' },
 *     expected: { amount: 499 },
 *   });
 *   // → result.verified === true if payment found
 */

export const VERSION = "0.1.0";

// Primary API — unified verification
export { verifyPayment, fetchAndVerifyPayment } from "./verify.js";
export type { VerifyPaymentOptions, FetchAndVerifyOptions, VerificationPreset } from "./verify.js";

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
export { sanitizeEmailForLlm } from "./llm/index.js";
export type { LlmConfig, LlmProvider } from "./llm/index.js";

// Security — 5-layer validation pipeline
export { SecurityValidator } from "./security/index.js";
export { InMemoryDedupStore, type DedupStore } from "./security/index.js";
export { PostgresDedupStore } from "./security/index.js";
export { registerBankPattern, isKnownBankEmail } from "./security/index.js";
export type { BankPattern } from "./security/index.js";
export type {
  SecurityConfig,
  VerificationRequest,
  VerificationResult,
  ValidationFailureReason,
} from "./security/index.js";

// Utilities — logging, errors, retry, cost tracking, rate limiting
export { Logger, type LogLevel, type LogHandler } from "./utils/index.js";
export { CostTracker } from "./utils/index.js";
export { LlmRateLimiter } from "./utils/index.js";
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

// Crypto — encrypt/decrypt sensitive credentials
export { encrypt, decrypt, isEncrypted, generateKey } from "./utils/crypto.js";
