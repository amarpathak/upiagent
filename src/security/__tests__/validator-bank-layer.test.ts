// packages/core/src/security/__tests__/validator-bank-layer.test.ts
import { describe, it, expect } from "vitest";
import { SecurityValidator } from "../validator.js";
import { InMemoryDedupStore } from "../dedup.js";
import type { ParsedPayment } from "../../llm/schema.js";

function makePayment(overrides: Partial<ParsedPayment> = {}): ParsedPayment {
  return {
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
    ...overrides,
  };
}

describe("SecurityValidator — bank source layer", () => {
  it("passes known bank sender with confidence 0.5", async () => {
    const validator = new SecurityValidator({}, new InMemoryDedupStore());
    const result = await validator.validate(
      makePayment({ confidence: 0.55 }),
      { expectedAmount: 499.37 },
      undefined,
      { from: "alerts@hdfcbank.net" }
    );
    expect(result.verified).toBe(true);
  });

  it("passes unknown bank sender with confidence >= 0.8", async () => {
    const validator = new SecurityValidator({}, new InMemoryDedupStore());
    const result = await validator.validate(
      makePayment({ confidence: 0.85 }),
      { expectedAmount: 499.37 },
      undefined,
      { from: "unknown@randombank.com" }
    );
    expect(result.verified).toBe(true);
  });

  it("rejects unknown bank sender with confidence < 0.8", async () => {
    const validator = new SecurityValidator({}, new InMemoryDedupStore());
    const result = await validator.validate(
      makePayment({ confidence: 0.6 }),
      { expectedAmount: 499.37 },
      undefined,
      { from: "unknown@randombank.com" }
    );
    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe("LOW_CONFIDENCE");
    expect(result.failureDetails).toContain("unknown sender");
  });

  it("passes when no email metadata provided (backwards compat)", async () => {
    const validator = new SecurityValidator({}, new InMemoryDedupStore());
    const result = await validator.validate(
      makePayment({ confidence: 0.55 }),
      { expectedAmount: 499.37 }
    );
    expect(result.verified).toBe(true);
  });

  it("includes bank_source in layer results", async () => {
    const validator = new SecurityValidator({}, new InMemoryDedupStore());
    const result = await validator.validate(
      makePayment(),
      { expectedAmount: 499.37 },
      undefined,
      { from: "alerts@hdfcbank.net" }
    );
    const bankLayer = result.layerResults.find(l => l.layer === "bank_source");
    expect(bankLayer).toBeDefined();
    expect(bankLayer!.passed).toBe(true);
  });
});
