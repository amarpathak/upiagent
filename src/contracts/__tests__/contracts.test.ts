import { describe, it, expect } from "vitest";
import {
  createPaymentRequestSchema,
  createPaymentResponseSchema,
  paymentSchema,
  verifyPaymentResponseSchema,
  notifyRequestSchema,
  webhookPayloadSchema,
  formatContractError,
} from "../index.js";

describe("createPaymentRequestSchema", () => {
  it("accepts a minimal request", () => {
    expect(createPaymentRequestSchema.parse({ amount: 499 })).toEqual({ amount: 499 });
  });

  it.each([
    [{}, "amount"],
    [{ amount: 0 }, "amount"],
    [{ amount: 100_001 }, "amount"],
    [{ amount: "499" }, "amount"],
    [{ amount: Number.NaN }, "amount"],
    [{ amount: 10, addPaisa: "yes" }, "addPaisa"],
    [{ amount: 10, note: "x".repeat(501) }, "note"],
  ])("rejects %j with an error naming %s", (input, field) => {
    const result = createPaymentRequestSchema.safeParse(input);
    expect(result.success).toBe(false);
    if (!result.success) expect(formatContractError(result.error)).toMatch(new RegExp(`^${field}:`));
  });
});

describe("response schemas", () => {
  it("createPaymentResponse requires createdAt (the SDK promised it)", () => {
    const base = {
      id: "p1",
      transactionId: "TXN_1",
      amount: 499.37,
      intentUrl: "upi://pay?pa=x@ybl",
      qrDataUrl: "data:image/png;base64,AA",
      status: "pending",
      expiresAt: "2026-09-24T18:00:00Z",
    };
    expect(createPaymentResponseSchema.safeParse(base).success).toBe(false);
    expect(createPaymentResponseSchema.safeParse({ ...base, createdAt: "2026-09-24T17:40:00Z" }).success).toBe(true);
  });

  it("payment accepts the nulls Postgres returns for unset columns", () => {
    const row = {
      id: "p1",
      transactionId: "TXN_1",
      amount: 499,
      note: null,
      status: "pending",
      intentUrl: null,
      qrDataUrl: null,
      expiresAt: null,
      createdAt: "2026-09-24T17:40:00Z",
    };
    expect(paymentSchema.parse(row).note).toBeNull();
  });

  it("payment rejects unknown statuses", () => {
    expect(
      paymentSchema.safeParse({ id: "p", transactionId: "t", amount: 1, status: "paid", createdAt: "x" }).success,
    ).toBe(false);
  });

  it("verify response accepts verified and pending shapes", () => {
    expect(verifyPaymentResponseSchema.safeParse({ verified: false, status: "pending", message: "no match" }).success).toBe(true);
    expect(
      verifyPaymentResponseSchema.safeParse({
        verified: true,
        status: "verified",
        payment: { amount: 1, upiReferenceId: "123456789012", senderName: "A", bankName: "HDFC", confidence: 0.9 },
      }).success,
    ).toBe(true);
  });
});

describe("notifyRequestSchema", () => {
  const n = { packageName: "com.phonepe.app", title: "Received", body: "₹499 received", receivedAt: 1_727_000_000_000 };

  it("normalises the legacy single-notification form", () => {
    expect(notifyRequestSchema.parse({ notification: n, deviceId: "d1" })).toEqual({ notifications: [n], deviceId: "d1" });
  });

  it("rejects an empty request", () => {
    const result = notifyRequestSchema.safeParse({});
    expect(result.success).toBe(false);
    if (!result.success) expect(formatContractError(result.error)).toBe("No notifications provided");
  });

  it("caps the batch at 20", () => {
    expect(notifyRequestSchema.safeParse({ notifications: Array(21).fill(n) }).success).toBe(false);
  });

  it("bounds field sizes", () => {
    expect(notifyRequestSchema.safeParse({ notification: { ...n, body: "x".repeat(5001) } }).success).toBe(false);
  });
});

describe("webhookPayloadSchema", () => {
  it("accepts a verified payload and rejects a wrong currency", () => {
    const payload = {
      event: "payment.verified",
      timestamp: "2026-09-24T17:40:00Z",
      deliveryId: "d1",
      data: { paymentId: "p1", amount: 499, currency: "INR", status: "verified" },
    };
    expect(webhookPayloadSchema.safeParse(payload).success).toBe(true);
    expect(webhookPayloadSchema.safeParse({ ...payload, data: { ...payload.data, currency: "USD" } }).success).toBe(false);
  });
});
