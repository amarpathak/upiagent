/**
 * Payment Creation Tests
 *
 * Tests the QR code generation and UPI intent URL creation flow.
 * These are local operations — no API calls to Gmail or LLM.
 */

import { describe, it, expect } from "vitest";
import { createPayment, createPaymentSvg } from "../src/payment/index.js";

const testMerchant = {
  upiId: "testshop@ybl",
  name: "Test Shop",
};

describe("createPayment", () => {
  it("creates a payment with QR code", async () => {
    const payment = await createPayment(testMerchant, {
      amount: 499,
      note: "Order #123",
    });

    expect(payment.amount).toBe(499);
    expect(payment.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(payment.intentUrl).toContain("upi://pay");
    expect(payment.intentUrl).toContain("testshop%40ybl");
    expect(payment.merchantUpiId).toBe("testshop@ybl");
    expect(payment.transactionId).toMatch(/^TXN_/);
  });

  it("respects custom transaction ID", async () => {
    const payment = await createPayment(testMerchant, {
      amount: 100,
      transactionId: "MY_ORDER_456",
    });

    expect(payment.transactionId).toBe("MY_ORDER_456");
    expect(payment.intentUrl).toContain("MY_ORDER_456");
  });
});

describe("createPaymentSvg", () => {
  it("creates SVG payment QR", async () => {
    const result = await createPaymentSvg(testMerchant, {
      amount: 250,
      transactionId: "TXN_custom_id",
    });

    expect(result.svg).toContain("<svg");
    expect(result.transactionId).toBe("TXN_custom_id");
  });
});
