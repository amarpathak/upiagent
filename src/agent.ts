/**
 * UpiAgent — Main Orchestrator
 *
 * Public-facing class that consumers interact with.
 * Orchestrates the full payment flow with production features:
 * structured logging, retry logic, and cost tracking.
 */

import { GmailClient } from "./gmail/index.js";
import { parsePaymentEmail } from "./llm/index.js";
import { SecurityValidator } from "./security/index.js";
import { createPayment, createPaymentSvg } from "./payment/index.js";
import { Logger } from "./utils/logger.js";
import { withRetry } from "./utils/retry.js";
import { CostTracker } from "./utils/cost.js";
import { LlmError } from "./utils/errors.js";
import type { LogLevel, LogHandler } from "./utils/logger.js";
import type { GmailCredentials, GmailSearchOptions } from "./gmail/index.js";
import type { LlmConfig } from "./llm/index.js";
import type { SecurityConfig, VerificationRequest, VerificationResult } from "./security/index.js";
import type { DedupStore } from "./security/index.js";
import type { MerchantConfig, CreatePaymentOptions, PaymentRequest } from "./payment/index.js";

export interface UpiAgentConfig {
  /** Merchant details — who receives payments */
  merchant: MerchantConfig;

  /** Gmail API credentials for fetching bank alert emails */
  gmail: GmailCredentials;

  /** LLM provider configuration for parsing emails */
  llm: LlmConfig;

  /** Security settings — time windows, amount tolerance, etc. */
  security?: SecurityConfig;

  /** Custom dedup store (defaults to in-memory) */
  dedupStore?: DedupStore;

  /** Logging configuration */
  logging?: {
    /** Minimum log level (default: "info") */
    level?: LogLevel;
    /** Custom log handler — redirect logs to your system */
    handler?: LogHandler;
  };

  /** LLM cost control */
  costControl?: {
    /** Maximum total tokens per agent instance. 0 = unlimited. */
    budgetTokens?: number;
    /** Max retry attempts for LLM calls (default: 3) */
    maxRetries?: number;
  };
}

export class UpiAgent {
  private gmailClient: GmailClient;
  private llmConfig: LlmConfig;
  private securityValidator: SecurityValidator;
  private merchant: MerchantConfig;
  private logger: Logger;
  private costTracker: CostTracker;
  private maxRetries: number;

  constructor(config: UpiAgentConfig) {
    this.logger = new Logger({
      level: config.logging?.level ?? "info",
      handler: config.logging?.handler,
      context: { module: "upiagent" },
    });

    this.costTracker = new CostTracker({
      budgetTokens: config.costControl?.budgetTokens,
      logger: this.logger.child({ component: "cost" }),
    });

    this.maxRetries = config.costControl?.maxRetries ?? 3;

    this.merchant = config.merchant;
    this.gmailClient = new GmailClient(config.gmail);
    this.llmConfig = config.llm;
    this.securityValidator = new SecurityValidator(config.security, config.dedupStore);

    this.logger.info("UpiAgent initialized", {
      merchant: config.merchant.upiId,
      llmProvider: config.llm.provider,
      llmModel: config.llm.model ?? "default",
    });
  }

  /**
   * Create a payment request with QR code.
   */
  async createPayment(options: CreatePaymentOptions): Promise<PaymentRequest> {
    this.logger.info("Creating payment", { amount: options.amount, note: options.note });
    const payment = await createPayment(this.merchant, options);
    this.logger.info("Payment created", {
      transactionId: payment.transactionId,
      amount: payment.amount,
    });
    return payment;
  }

  /**
   * Creates a payment QR as an SVG string.
   */
  async createPaymentSvg(options: CreatePaymentOptions) {
    return createPaymentSvg(this.merchant, options);
  }

  /**
   * Verify that a payment was received.
   *
   * Full pipeline: Gmail → LLM (with retry) → Security → Result
   */
  async verifyPayment(
    request: VerificationRequest,
    gmailOptions?: GmailSearchOptions,
  ): Promise<VerificationResult> {
    const verifyLogger = this.logger.child({
      operation: "verifyPayment",
      expectedAmount: request.expectedAmount,
    });

    verifyLogger.info("Starting payment verification");

    // Step 1: Fetch emails (with retry for transient Gmail errors)
    const emails = await withRetry(
      () =>
        this.gmailClient.fetchBankAlerts({
          lookbackMinutes: request.lookbackMinutes ?? 30,
          ...gmailOptions,
        }),
      {
        maxAttempts: this.maxRetries,
        logger: verifyLogger.child({ step: "gmail_fetch" }),
      },
    );

    verifyLogger.info("Fetched bank alert emails", { count: emails.length });

    if (emails.length === 0) {
      verifyLogger.warn("No bank alert emails found");
      return {
        verified: false,
        payment: null,
        confidence: 0,
        failureReason: "FORMAT_INVALID",
        failureDetails: "No bank alert emails found in the specified time window",
        layerResults: [],
      };
    }

    // Step 2: Parse each email and validate
    for (const email of emails) {
      verifyLogger.debug("Parsing email", { emailId: email.id, from: email.from });

      let parsed;
      try {
        parsed = await withRetry(() => parsePaymentEmail(email, this.llmConfig), {
          maxAttempts: this.maxRetries,
          logger: verifyLogger.child({ step: "llm_parse", emailId: email.id }),
          retryIf: (error) => {
            // Retry on rate limits and transient errors, not on validation failures
            const msg = error instanceof Error ? error.message : "";
            return msg.includes("rate") || msg.includes("timeout") || msg.includes("503");
          },
        });
      } catch (error) {
        verifyLogger.error("LLM parsing failed", {
          emailId: email.id,
          error: error instanceof Error ? error.message : String(error),
        });
        throw new LlmError(
          `Failed to parse email ${email.id}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }

      if (!parsed) {
        verifyLogger.debug("Email could not be parsed, skipping", { emailId: email.id });
        continue;
      }

      verifyLogger.debug("Email parsed", {
        emailId: email.id,
        amount: parsed.amount,
        isPayment: parsed.isPaymentEmail,
        confidence: parsed.confidence,
      });

      // Run through security validation — pass email.receivedAt as fallback
      // for when the LLM can't extract the exact transaction time from the email
      const result = await this.securityValidator.validate(parsed, request, email.receivedAt);

      if (result.verified) {
        verifyLogger.info("Payment verified", {
          amount: parsed.amount,
          upiRef: parsed.upiReferenceId,
          confidence: parsed.confidence,
        });
        return result;
      }

      // Return specific failure for non-trivial rejections
      if (
        result.failureReason !== "NOT_PAYMENT_EMAIL" &&
        result.failureReason !== "LOW_CONFIDENCE"
      ) {
        verifyLogger.warn("Payment rejected by security layer", {
          reason: result.failureReason,
          details: result.failureDetails,
        });
        return result;
      }
    }

    verifyLogger.warn("No matching payment found", {
      emailsChecked: emails.length,
      expectedAmount: request.expectedAmount,
    });

    return {
      verified: false,
      payment: null,
      confidence: 0,
      failureReason: "AMOUNT_MISMATCH",
      failureDetails: `No payment of ₹${request.expectedAmount} found in ${emails.length} bank alert email(s)`,
      layerResults: [],
    };
  }

  /** Get current LLM token usage */
  getTokenUsage() {
    return this.costTracker.getUsage();
  }

  /** Reset token usage counters */
  resetTokenUsage(): void {
    this.costTracker.reset();
  }
}
