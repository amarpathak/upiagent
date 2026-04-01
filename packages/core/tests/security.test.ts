/**
 * Security Layer Tests
 *
 * These tests attempt to BREAK each security layer. The goal is to
 * verify that every attack vector we identified is caught.
 *
 * Testing philosophy: Security tests should be adversarial. Don't just
 * test the happy path — test what happens when someone actively tries
 * to fool the system.
 */

import { describe, it, expect, beforeEach } from "vitest";
import { SecurityValidator } from "../src/security/validator.js";
import { InMemoryDedupStore } from "../src/security/dedup.js";
import type { ParsedPayment } from "../src/llm/schema.js";
import type { VerificationRequest } from "../src/security/types.js";

/**
 * Helper: creates a valid ParsedPayment for testing.
 * Tests override specific fields to simulate attack scenarios.
 */
function makePayment(overrides: Partial<ParsedPayment> = {}): ParsedPayment {
  return {
    amount: 499,
    upiReferenceId: "412345678901",
    senderName: "John Doe",
    senderUpiId: "john@ybl",
    bankName: "HDFC Bank",
    timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 mins ago
    status: "success",
    rawSubject: "Alert : HDFC Bank Credit",
    confidence: 0.95,
    isPaymentEmail: true,
    ...overrides,
  };
}

function makeRequest(overrides: Partial<VerificationRequest> = {}): VerificationRequest {
  return {
    expectedAmount: 499,
    lookbackMinutes: 30,
    ...overrides,
  };
}

describe("Security Validator", () => {
  let validator: SecurityValidator;

  beforeEach(() => {
    // Fresh validator for each test — no leaked state between tests
    validator = new SecurityValidator();
  });

  // ── Happy Path ───────────────────────────────────────────────

  it("accepts a valid, matching payment", async () => {
    const result = await validator.validate(makePayment(), makeRequest());

    expect(result.verified).toBe(true);
    expect(result.confidence).toBe(0.95);
    expect(result.layerResults).toHaveLength(5);
    expect(result.layerResults.every((l) => l.passed)).toBe(true);
  });

  // ── Layer 1: Format Validation ───────────────────────────────

  describe("Layer 1: Format Validation", () => {
    it("rejects non-payment emails", async () => {
      // Attack: Someone forwards an OTP email or promo email
      const payment = makePayment({ isPaymentEmail: false });
      const result = await validator.validate(payment, makeRequest());

      expect(result.verified).toBe(false);
      expect(result.failureReason).toBe("NOT_PAYMENT_EMAIL");
    });

    it("rejects low-confidence extractions", async () => {
      // Scenario: LLM wasn't sure about the extraction — maybe the
      // email was in an unusual format or a language it struggled with
      const payment = makePayment({ confidence: 0.3 });
      const result = await validator.validate(payment, makeRequest());

      expect(result.verified).toBe(false);
      expect(result.failureReason).toBe("LOW_CONFIDENCE");
    });

    it("accepts confidence at exactly 0.5 (threshold)", async () => {
      const payment = makePayment({ confidence: 0.5 });
      const result = await validator.validate(payment, makeRequest());

      expect(result.verified).toBe(true);
    });
  });

  // ── Layer 2: Amount Matching ─────────────────────────────────

  describe("Layer 2: Amount Matching", () => {
    it("rejects mismatched amounts (attacker pays less)", async () => {
      // Attack: User pays Rs.1 but claims they paid Rs.499
      const payment = makePayment({ amount: 1 });
      const result = await validator.validate(payment, makeRequest({ expectedAmount: 499 }));

      expect(result.verified).toBe(false);
      expect(result.failureReason).toBe("AMOUNT_MISMATCH");
      expect(result.failureDetails).toContain("499");
      expect(result.failureDetails).toContain("1");
    });

    it("rejects overpayment (LLM hallucination)", async () => {
      // Scenario: LLM adds an extra zero to the amount
      const payment = makePayment({ amount: 4990 });
      const result = await validator.validate(payment, makeRequest({ expectedAmount: 499 }));

      expect(result.verified).toBe(false);
      expect(result.failureReason).toBe("AMOUNT_MISMATCH");
    });

    it("handles floating point precision correctly", async () => {
      // Edge case: Rs.499.00 vs Rs.499 — should be exact match
      const payment = makePayment({ amount: 499.0 });
      const result = await validator.validate(payment, makeRequest({ expectedAmount: 499 }));

      expect(result.verified).toBe(true);
    });

    it("handles tiny floating point differences (0.001)", async () => {
      // JavaScript: 0.1 + 0.2 = 0.30000000000000004
      // Our 0.01 tolerance handles this
      const payment = makePayment({ amount: 499.009 });
      const result = await validator.validate(payment, makeRequest({ expectedAmount: 499 }));

      expect(result.verified).toBe(true);
    });

    it("rejects amounts off by more than 1 paisa", async () => {
      const payment = makePayment({ amount: 499.02 });
      const result = await validator.validate(payment, makeRequest({ expectedAmount: 499 }));

      expect(result.verified).toBe(false);
      expect(result.failureReason).toBe("AMOUNT_MISMATCH");
    });

    it("respects tolerance when configured", async () => {
      // With 2% tolerance on Rs.1000, anything from Rs.980-1020 is accepted
      const tolerantValidator = new SecurityValidator({ amountTolerancePercent: 2 });

      const payment = makePayment({ amount: 985 });
      const result = await tolerantValidator.validate(
        payment,
        makeRequest({ expectedAmount: 1000 }),
      );

      expect(result.verified).toBe(true);
    });

    it("rejects amounts outside tolerance range", async () => {
      const tolerantValidator = new SecurityValidator({ amountTolerancePercent: 2 });

      const payment = makePayment({ amount: 970 }); // 3% off
      const result = await tolerantValidator.validate(
        payment,
        makeRequest({ expectedAmount: 1000 }),
      );

      expect(result.verified).toBe(false);
      expect(result.failureReason).toBe("AMOUNT_MISMATCH");
    });
  });

  // ── Layer 3: Time Window ─────────────────────────────────────

  describe("Layer 3: Time Window", () => {
    it("rejects payments outside time window (replay attack)", async () => {
      // Attack: Attacker uses a 2-hour-old payment email
      const twoHoursAgo = new Date(Date.now() - 120 * 60 * 1000).toISOString();
      const payment = makePayment({ timestamp: twoHoursAgo });
      const result = await validator.validate(payment, makeRequest({ lookbackMinutes: 30 }));

      expect(result.verified).toBe(false);
      expect(result.failureReason).toBe("OUTSIDE_TIME_WINDOW");
    });

    it("accepts payments within time window", async () => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const payment = makePayment({ timestamp: fiveMinutesAgo });
      const result = await validator.validate(payment, makeRequest({ lookbackMinutes: 30 }));

      expect(result.verified).toBe(true);
    });

    it("rejects future-dated payments (clock skew attack)", async () => {
      // Attack: Forge a payment with a future timestamp to bypass window check
      const tenMinutesFuture = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const payment = makePayment({ timestamp: tenMinutesFuture });
      const result = await validator.validate(payment, makeRequest());

      expect(result.verified).toBe(false);
      expect(result.failureReason).toBe("OUTSIDE_TIME_WINDOW");
      expect(result.failureDetails).toContain("future");
    });

    it("allows slight clock skew (under 5 minutes)", async () => {
      // Real scenario: Server clock is 2 minutes ahead of bank's clock
      const twoMinutesFuture = new Date(Date.now() + 2 * 60 * 1000).toISOString();
      const payment = makePayment({ timestamp: twoMinutesFuture });
      const result = await validator.validate(payment, makeRequest());

      expect(result.verified).toBe(true);
    });

    it("passes when timestamp is empty (trusts Gmail time filter)", async () => {
      // Some bank emails don't include a parseable timestamp.
      // In this case, we rely on the Gmail search query's after: filter.
      const payment = makePayment({ timestamp: "" });
      const result = await validator.validate(payment, makeRequest());

      expect(result.verified).toBe(true);
    });
  });

  // ── Layer 4: Duplicate Detection ─────────────────────────────

  describe("Layer 4: Duplicate Detection", () => {
    it("rejects duplicate UPI reference IDs", async () => {
      // Attack: Submit the same payment twice → double credit
      const payment = makePayment({ upiReferenceId: "999999999999" });
      const request = makeRequest();

      // First verification passes
      const first = await validator.validate(payment, request);
      expect(first.verified).toBe(true);

      // Second verification with same ref ID fails
      const second = await validator.validate(payment, request);
      expect(second.verified).toBe(false);
      expect(second.failureReason).toBe("DUPLICATE_TRANSACTION");
    });

    it("allows different UPI reference IDs", async () => {
      const request = makeRequest();

      const first = await validator.validate(
        makePayment({ upiReferenceId: "111111111111" }),
        request,
      );
      expect(first.verified).toBe(true);

      const second = await validator.validate(
        makePayment({ upiReferenceId: "222222222222" }),
        request,
      );
      expect(second.verified).toBe(true);
    });
  });

  // ── Pipeline Order ───────────────────────────────────────────

  describe("Pipeline Order", () => {
    it("stops at first failure (doesn't run later layers)", async () => {
      // This payment fails Layer 1 (not a payment email).
      // Layers 2-4 should NOT be run.
      const payment = makePayment({ isPaymentEmail: false });
      const result = await validator.validate(payment, makeRequest());

      expect(result.verified).toBe(false);
      expect(result.layerResults).toHaveLength(1); // Only Layer 1 ran
      expect(result.layerResults[0]?.layer).toBe("format");
    });

    it("runs all layers on valid payment", async () => {
      const result = await validator.validate(makePayment(), makeRequest());

      expect(result.verified).toBe(true);
      expect(result.layerResults).toHaveLength(5);
    });
  });
});

// ── Dedup Store Tests ────────────────────────────────────────────

describe("InMemoryDedupStore", () => {
  it("tracks added reference IDs", async () => {
    const store = new InMemoryDedupStore();

    expect(await store.has("ref-1")).toBe(false);
    await store.add("ref-1");
    expect(await store.has("ref-1")).toBe(true);
  });

  it("expires entries after TTL", async () => {
    // Use a very short TTL for testing (0.01 minutes = 600ms)
    const store = new InMemoryDedupStore(0.01);

    await store.add("ref-expire");
    expect(await store.has("ref-expire")).toBe(true);

    // Wait for expiry
    await new Promise((resolve) => setTimeout(resolve, 700));

    expect(await store.has("ref-expire")).toBe(false);
  });
});
