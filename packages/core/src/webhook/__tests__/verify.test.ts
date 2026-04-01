// packages/core/src/webhook/__tests__/verify.test.ts
import { describe, it, expect } from "vitest";
import { signWebhookPayload, verifyWebhookSignature } from "../verify.js";

describe("webhook signature", () => {
  const secret = "a".repeat(64);
  const body = '{"event":"payment.verified","data":{}}';

  describe("signWebhookPayload", () => {
    it("returns sha256= prefixed HMAC hex string", () => {
      const sig = signWebhookPayload(body, secret);
      expect(sig).toMatch(/^sha256=[a-f0-9]{64}$/);
    });

    it("produces same signature for same input", () => {
      const sig1 = signWebhookPayload(body, secret);
      const sig2 = signWebhookPayload(body, secret);
      expect(sig1).toBe(sig2);
    });

    it("produces different signature for different body", () => {
      const sig1 = signWebhookPayload(body, secret);
      const sig2 = signWebhookPayload('{"different":true}', secret);
      expect(sig1).not.toBe(sig2);
    });

    it("produces different signature for different secret", () => {
      const sig1 = signWebhookPayload(body, secret);
      const sig2 = signWebhookPayload(body, "b".repeat(64));
      expect(sig1).not.toBe(sig2);
    });
  });

  describe("verifyWebhookSignature", () => {
    it("returns true for valid signature", () => {
      const sig = signWebhookPayload(body, secret);
      expect(verifyWebhookSignature(body, sig, secret)).toBe(true);
    });

    it("returns false for tampered body", () => {
      const sig = signWebhookPayload(body, secret);
      expect(verifyWebhookSignature('{"tampered":true}', sig, secret)).toBe(false);
    });

    it("returns false for wrong secret", () => {
      const sig = signWebhookPayload(body, secret);
      expect(verifyWebhookSignature(body, sig, "b".repeat(64))).toBe(false);
    });

    it("returns false for malformed signature", () => {
      expect(verifyWebhookSignature(body, "not-a-sig", secret)).toBe(false);
    });

    it("returns false for empty signature", () => {
      expect(verifyWebhookSignature(body, "", secret)).toBe(false);
    });
  });
});
