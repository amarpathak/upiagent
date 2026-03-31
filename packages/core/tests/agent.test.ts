/**
 * UpiAgent Integration Tests
 *
 * These test the UpiAgent class's payment creation flow.
 * The verification flow requires Gmail + LLM (tested manually with real credentials).
 * Here we test what we can without external services.
 */

import { describe, it, expect } from "vitest";
import { UpiAgent } from "../src/agent.js";
import type { UpiAgentConfig } from "../src/agent.js";

/**
 * Create a test agent config.
 *
 * Gmail and LLM configs use dummy values — they won't be used in
 * payment creation tests (QR generation is local, no API calls).
 * They'd fail on verifyPayment, but that's expected without real credentials.
 */
function makeTestConfig(): UpiAgentConfig {
  return {
    merchant: {
      upiId: "testshop@ybl",
      name: "Test Shop",
    },
    gmail: {
      clientId: "test-client-id",
      clientSecret: "test-client-secret",
      refreshToken: "test-refresh-token",
    },
    llm: {
      provider: "openai",
      apiKey: "test-api-key",
    },
  };
}

describe("UpiAgent", () => {
  it("creates a payment with QR code", async () => {
    const agent = new UpiAgent(makeTestConfig());

    const payment = await agent.createPayment({
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

  it("creates SVG payment QR", async () => {
    const agent = new UpiAgent(makeTestConfig());

    const result = await agent.createPaymentSvg({
      amount: 250,
      transactionId: "TXN_custom_id",
    });

    expect(result.svg).toContain("<svg");
    expect(result.transactionId).toBe("TXN_custom_id");
  });

  it("respects custom transaction ID", async () => {
    const agent = new UpiAgent(makeTestConfig());

    const payment = await agent.createPayment({
      amount: 100,
      transactionId: "MY_ORDER_456",
    });

    expect(payment.transactionId).toBe("MY_ORDER_456");
    expect(payment.intentUrl).toContain("MY_ORDER_456");
  });
});
