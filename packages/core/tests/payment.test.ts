/**
 * Payment Module Tests
 *
 * Tests UPI intent URL generation and QR code creation.
 * These are fully deterministic — no external APIs, no LLM, no randomness
 * (we provide explicit transaction IDs in tests).
 */

import { describe, it, expect } from "vitest";
import { buildUpiIntentUrl, generateTransactionId } from "../src/payment/intent.js";
import { createPayment, createPaymentSvg } from "../src/payment/qr.js";
import type { MerchantConfig } from "../src/payment/types.js";

const testMerchant: MerchantConfig = {
  upiId: "shop@ybl",
  name: "Test Shop",
};

describe("UPI Intent URL", () => {
  it("builds correct UPI intent URL with all parameters", () => {
    const url = buildUpiIntentUrl(testMerchant, {
      amount: 499,
      transactionId: "TXN_test_123",
      note: "Order 42",
    });

    // Verify the URL scheme
    expect(url).toMatch(/^upi:\/\/pay\?/);

    // Parse the URL to check parameters
    // We need to handle the custom scheme — URL constructor doesn't support upi://
    const params = new URLSearchParams(url.split("?")[1]);

    expect(params.get("pa")).toBe("shop@ybl");
    expect(params.get("pn")).toBe("Test Shop");
    expect(params.get("am")).toBe("499.00");
    expect(params.get("tr")).toBe("TXN_test_123");
    expect(params.get("cu")).toBe("INR");
    expect(params.get("tn")).toBe("Order 42");
  });

  it("formats amount to 2 decimal places", () => {
    const url = buildUpiIntentUrl(testMerchant, {
      amount: 100,
      transactionId: "TXN_test",
    });

    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("am")).toBe("100.00");
  });

  it("handles decimal amounts correctly", () => {
    const url = buildUpiIntentUrl(testMerchant, {
      amount: 99.5,
      transactionId: "TXN_test",
    });

    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("am")).toBe("99.50");
  });

  it("omits note when not provided", () => {
    const url = buildUpiIntentUrl(testMerchant, {
      amount: 499,
      transactionId: "TXN_test",
    });

    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.has("tn")).toBe(false);
  });

  it("URL-encodes special characters in merchant name", () => {
    const merchantWithSpecial: MerchantConfig = {
      upiId: "shop@ybl",
      name: "Amar's Shop & Cafe",
    };

    const url = buildUpiIntentUrl(merchantWithSpecial, {
      amount: 100,
      transactionId: "TXN_test",
    });

    // The name should be URL-encoded in the raw URL
    expect(url).toContain("pa=shop%40ybl");
    // And decodable back to the original
    const params = new URLSearchParams(url.split("?")[1]);
    expect(params.get("pn")).toBe("Amar's Shop & Cafe");
  });
});

describe("Transaction ID Generation", () => {
  it("generates unique IDs", () => {
    const id1 = generateTransactionId();
    const id2 = generateTransactionId();

    expect(id1).not.toBe(id2);
  });

  it("starts with TXN_ prefix", () => {
    const id = generateTransactionId();
    expect(id).toMatch(/^TXN_/);
  });
});

describe("QR Code Generation", () => {
  it("creates a payment with QR data URL", async () => {
    const payment = await createPayment(testMerchant, {
      amount: 499,
      transactionId: "TXN_qr_test",
      note: "Test payment",
    });

    // QR data URL should be a valid PNG data URL
    expect(payment.qrDataUrl).toMatch(/^data:image\/png;base64,/);

    // Other fields should be populated
    expect(payment.transactionId).toBe("TXN_qr_test");
    expect(payment.amount).toBe(499);
    expect(payment.merchantUpiId).toBe("shop@ybl");
    expect(payment.intentUrl).toContain("upi://pay");
    expect(payment.createdAt).toBeInstanceOf(Date);
  });

  it("creates SVG output", async () => {
    const result = await createPaymentSvg(testMerchant, {
      amount: 250,
      transactionId: "TXN_svg_test",
    });

    expect(result.svg).toContain("<svg");
    expect(result.svg).toContain("</svg>");
    expect(result.intentUrl).toContain("upi://pay");
    expect(result.transactionId).toBe("TXN_svg_test");
  });

  it("auto-generates transaction ID when not provided", async () => {
    const payment = await createPayment(testMerchant, { amount: 100 });

    expect(payment.transactionId).toMatch(/^TXN_/);
    expect(payment.transactionId.length).toBeGreaterThan(10);
  });
});
