// packages/core/src/__tests__/verify.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EmailMessage } from "../gmail/types.js";
import type { LlmConfig } from "../llm/types.js";

vi.mock("../llm/chain.js", () => ({
  parsePaymentEmail: vi.fn(),
}));

import { parsePaymentEmail } from "../llm/chain.js";
import { verifyPayment } from "../verify.js";

const mockParse = vi.mocked(parsePaymentEmail);

const testEmail: EmailMessage = {
  id: "msg-1",
  subject: "HDFC Bank Alert",
  body: "Rs. 499.37 has been credited. UPI Ref: 412345678901",
  from: "alerts@hdfcbank.net",
  receivedAt: new Date(),
};

const testLlmConfig: LlmConfig = {
  provider: "gemini",
  model: "gemini-2.0-flash",
  apiKey: "test-key",
};

describe("verifyPayment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns verified result when all layers pass", async () => {
    mockParse.mockResolvedValueOnce({
      amount: 499.37,
      upiReferenceId: "412345678901",
      senderName: "John Doe",
      senderUpiId: "john@ybl",
      bankName: "HDFC",
      timestamp: new Date().toISOString(),
      status: "success",
      rawSubject: "HDFC Bank Alert",
      confidence: 0.9,
      isPaymentEmail: true,
    });

    const result = await verifyPayment(testEmail, {
      llm: testLlmConfig,
      expected: { amount: 499.37 },
    });

    expect(result.verified).toBe(true);
    expect(result.payment).not.toBeNull();
    expect(result.payment!.amount).toBe(499.37);
  });

  it("returns unverified when amount does not match", async () => {
    mockParse.mockResolvedValueOnce({
      amount: 500.00,
      upiReferenceId: "412345678902",
      senderName: "John Doe",
      senderUpiId: "john@ybl",
      bankName: "HDFC",
      timestamp: new Date().toISOString(),
      status: "success",
      rawSubject: "HDFC Bank Alert",
      confidence: 0.9,
      isPaymentEmail: true,
    });

    const result = await verifyPayment(testEmail, {
      llm: testLlmConfig,
      expected: { amount: 499.37 },
    });

    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe("AMOUNT_MISMATCH");
  });

  it("returns null payment when LLM returns null", async () => {
    mockParse.mockResolvedValueOnce(null);

    const result = await verifyPayment(testEmail, {
      llm: testLlmConfig,
      expected: { amount: 499.37 },
    });

    expect(result.verified).toBe(false);
    expect(result.payment).toBeNull();
  });

  it("skips LLM when shouldSkipLlm returns true", async () => {
    const nonBankEmail: EmailMessage = {
      id: "msg-2",
      subject: "Hello",
      body: "No money content here at all",
      from: "random@gmail.com",
      receivedAt: new Date(),
    };

    const result = await verifyPayment(nonBankEmail, {
      llm: testLlmConfig,
      expected: { amount: 100 },
    });

    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe("NOT_PAYMENT_EMAIL");
    expect(mockParse).not.toHaveBeenCalled();
  });

  it("respects rate limiter", async () => {
    const { LlmRateLimiter } = await import("../utils/rate-limiter.js");
    const limiter = new LlmRateLimiter({ maxCallsPerMinute: 0 });

    const result = await verifyPayment(testEmail, {
      llm: testLlmConfig,
      expected: { amount: 499.37 },
      rateLimiter: limiter,
    });

    expect(result.verified).toBe(false);
    expect(result.failureDetails).toContain("rate limit");
  });

  describe("demo preset", () => {
    it("redacts PII in result", async () => {
      mockParse.mockResolvedValueOnce({
        amount: 499.37,
        upiReferenceId: "412345678901",
        senderName: "John Doe",
        senderUpiId: "john@ybl",
        bankName: "HDFC",
        timestamp: new Date().toISOString(),
        status: "success",
        rawSubject: "HDFC Bank Alert",
        confidence: 0.9,
        isPaymentEmail: true,
      });

      const result = await verifyPayment(testEmail, {
        llm: testLlmConfig,
        expected: { amount: 499.37 },
        preset: "demo",
      });

      expect(result.verified).toBe(true);
      expect(result.payment!.senderName).not.toBe("John Doe");
      expect(result.payment!.senderName).toContain("***");
      expect(result.payment!.senderUpiId).toContain("***");
      expect(result.payment!.upiReferenceId).toMatch(/^\*+\d{4}$/);
      expect(result.payment!.rawSubject).toBe("***");
    });
  });

  describe("UTR hint matching", () => {
    const makePayment = (amount: number, utr: string) => ({
      amount,
      upiReferenceId: utr,
      senderName: "John Doe",
      senderUpiId: "john@ybl",
      bankName: "HDFC",
      timestamp: new Date().toISOString(),
      status: "success" as const,
      rawSubject: "HDFC Bank Alert",
      confidence: 0.9,
      isPaymentEmail: true,
    });

    it("passes when UTR matches and amount is correct", async () => {
      mockParse.mockResolvedValueOnce(makePayment(499.37, "412345678901"));

      const result = await verifyPayment(testEmail, {
        llm: testLlmConfig,
        expected: { amount: 499.37 },
        expectedUtrs: ["412345678901"],
      });

      expect(result.verified).toBe(true);
      expect(result.matchedVia).toBe("utr_hint");
    });

    it("fails when UTR matches but amount is wildly different", async () => {
      mockParse.mockResolvedValueOnce(makePayment(1, "412345678901"));

      const result = await verifyPayment(testEmail, {
        llm: testLlmConfig,
        expected: { amount: 10000 },
        expectedUtrs: ["412345678901"],
      });

      expect(result.verified).toBe(false);
      expect(result.failureReason).toBe("AMOUNT_MISMATCH");
    });

    it("passes when UTR matches and amount is within relaxed tolerance", async () => {
      // 499 vs 499.37 — within 5% relaxed tolerance for UTR match
      mockParse.mockResolvedValueOnce(makePayment(499, "412345678901"));

      const result = await verifyPayment(testEmail, {
        llm: testLlmConfig,
        expected: { amount: 499.37 },
        expectedUtrs: ["412345678901"],
      });

      expect(result.verified).toBe(true);
      expect(result.matchedVia).toBe("utr_hint");
    });

    it("still checks amount without UTR hint (exact match)", async () => {
      mockParse.mockResolvedValueOnce(makePayment(499, "412345678901"));

      const result = await verifyPayment(testEmail, {
        llm: testLlmConfig,
        expected: { amount: 499.37 },
        // no expectedUtrs
      });

      expect(result.verified).toBe(false);
      expect(result.failureReason).toBe("AMOUNT_MISMATCH");
    });
  });
});
