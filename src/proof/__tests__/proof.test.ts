import { describe, it, expect } from "vitest";
import { adjudicateProof, decodeProofImage, MAX_PROOF_IMAGE_BYTES, type ScreenshotExtraction } from "../index.js";

const createdAt = new Date("2026-09-24T12:00:00+05:30");
const now = new Date("2026-09-24T12:04:00+05:30");
const expected = { amount: 499.37, payeeUpiId: "Shop@ybl", createdAt, now };

function shot(overrides: Partial<ScreenshotExtraction> = {}): ScreenshotExtraction {
  return {
    isPaymentScreenshot: true,
    transactionStatus: "success",
    amount: 499.37,
    upiReferenceId: "4123 4567 8901",
    payeeUpiId: "shop@ybl",
    payeeName: "Shop",
    paidAt: "2026-09-24T12:02:00+05:30",
    app: "PhonePe",
    confidence: 0.92,
    ...overrides,
  };
}

describe("adjudicateProof", () => {
  it("accepts a matching screenshot and normalises the UTR", () => {
    const v = adjudicateProof(shot(), expected);
    expect(v.accepted).toBe(true);
    expect(v.utr).toBe("412345678901");
    expect(v.confidence).toBe(0.92);
    expect(v.reasons).toContain("Payee UPI ID matches the merchant.");
  });

  it.each<[string, Partial<ScreenshotExtraction>, RegExp]>([
    ["not a payment screenshot", { isPaymentScreenshot: false }, /Not a UPI payment/],
    ["illegible", { confidence: 0.3 }, /not legible/],
    ["failed payment", { transactionStatus: "failed" }, /"failed", not success/],
    ["pending payment", { transactionStatus: "pending" }, /"pending"/],
    ["missing UTR", { upiReferenceId: null }, /No valid 12-digit/],
    ["malformed UTR", { upiReferenceId: "12345" }, /No valid 12-digit/],
    ["missing amount", { amount: null }, /Amount not visible/],
    ["underpayment by one paisa", { amount: 499.36 }, /does not match/],
    ["paid to someone else", { payeeUpiId: "attacker@ybl" }, /Paid to attacker@ybl, not this merchant/],
    ["paid before the request existed (replayed old receipt)", { paidAt: "2026-09-24T11:40:00+05:30" }, /before this payment request/],
    ["paid in the future", { paidAt: "2026-09-24T13:00:00+05:30" }, /in the future/],
  ])("rejects: %s", (_name, overrides, reason) => {
    const v = adjudicateProof(shot(overrides), expected);
    expect(v.accepted).toBe(false);
    expect(v.confidence).toBe(0);
    expect(v.reasons.at(-1)).toMatch(reason);
  });

  it("accepts but lowers confidence when payee or time is not visible", () => {
    const v = adjudicateProof(shot({ payeeUpiId: null, paidAt: null }), expected);
    expect(v.accepted).toBe(true);
    expect(v.confidence).toBe(0.7);
    expect(v.reasons.join(" ")).toMatch(/payee unconfirmed.*window unconfirmed/);
  });

  it("tolerates small clock skew", () => {
    expect(adjudicateProof(shot({ paidAt: "2026-09-24T11:57:00+05:30" }), expected).accepted).toBe(true);
  });
});

describe("decodeProofImage", () => {
  const png = "iVBORw0KGgo" + "A".repeat(200);

  it("accepts a data URL", () => {
    expect(decodeProofImage(`data:image/png;base64,${png}`)).toEqual({ mediaType: "image/png", base64: png });
  });

  it("accepts bare base64 with a media type", () => {
    expect(decodeProofImage(png, "image/jpeg").mediaType).toBe("image/jpeg");
  });

  it("rejects unsupported types, bad base64 and oversize images", () => {
    expect(() => decodeProofImage(png)).toThrow(/must be one of/);
    expect(() => decodeProofImage(`data:image/gif;base64,${png}`)).toThrow(/must be one of/);
    expect(() => decodeProofImage("not base64!!", "image/png")).toThrow(/not valid base64/);
    const huge = "A".repeat(Math.ceil((MAX_PROOF_IMAGE_BYTES * 4) / 3) + 8);
    expect(() => decodeProofImage(huge, "image/png")).toThrow(/larger than 3 MB/);
  });
});
