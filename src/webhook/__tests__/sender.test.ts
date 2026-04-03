// packages/core/src/webhook/__tests__/sender.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WebhookSender } from "../sender.js";
import type { WebhookPayload } from "../types.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function makePayload(overrides: Partial<WebhookPayload> = {}): WebhookPayload {
  return {
    event: "payment.verified",
    timestamp: new Date().toISOString(),
    deliveryId: "d_test123",
    data: {
      paymentId: "pay_abc",
      amount: 499.37,
      currency: "INR",
      status: "verified",
      upiReferenceId: "412345678901",
      senderName: "John Doe",
      confidence: 0.9,
      verifiedAt: new Date().toISOString(),
    },
    ...overrides,
  };
}

describe("WebhookSender", () => {
  const secret = "a".repeat(64);

  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("sends POST with correct headers", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const sender = new WebhookSender();
    await sender.send("https://merchant.com/webhook", secret, makePayload());
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://merchant.com/webhook");
    expect(opts.method).toBe("POST");
    expect(opts.headers["Content-Type"]).toBe("application/json");
    expect(opts.headers["X-UpiAgent-Signature"]).toMatch(/^sha256=[a-f0-9]{64}$/);
    expect(opts.headers["X-UpiAgent-Event"]).toBe("payment.verified");
    expect(opts.headers["X-UpiAgent-Delivery-Id"]).toBe("d_test123");
  });

  it("returns delivered: true on 200", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const sender = new WebhookSender();
    const result = await sender.send("https://merchant.com/webhook", secret, makePayload());
    expect(result.delivered).toBe(true);
    expect(result.attempts).toBe(1);
    expect(result.responseStatus).toBe(200);
  });

  it("retries on non-2xx and returns failure after max attempts", async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500 });
    const sender = new WebhookSender({ maxRetries: 3, retryDelaysMs: [0, 0, 0] });
    const result = await sender.send("https://merchant.com/webhook", secret, makePayload());
    expect(result.delivered).toBe(false);
    expect(result.attempts).toBe(3);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries on network error", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("ECONNREFUSED"))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    const sender = new WebhookSender({ maxRetries: 3, retryDelaysMs: [0, 0, 0] });
    const result = await sender.send("https://merchant.com/webhook", secret, makePayload());
    expect(result.delivered).toBe(true);
    expect(result.attempts).toBe(2);
  });

  it("does not retry on 2xx", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 201 });
    const sender = new WebhookSender();
    const result = await sender.send("https://merchant.com/webhook", secret, makePayload());
    expect(result.delivered).toBe(true);
    expect(result.attempts).toBe(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  describe("URL validation", () => {
    it("rejects HTTP URLs", async () => {
      const sender = new WebhookSender();
      await expect(
        sender.send("http://merchant.com/webhook", secret, makePayload())
      ).rejects.toThrow("HTTPS");
    });

    it("rejects localhost", async () => {
      const sender = new WebhookSender();
      await expect(
        sender.send("https://localhost/webhook", secret, makePayload())
      ).rejects.toThrow("localhost");
    });

    it("rejects private IP 10.x", async () => {
      const sender = new WebhookSender();
      await expect(
        sender.send("https://10.0.0.1/webhook", secret, makePayload())
      ).rejects.toThrow("private");
    });

    it("rejects URLs with userinfo credentials", async () => {
      const sender = new WebhookSender();
      await expect(
        sender.send("https://admin:password@internal.service/webhook", secret, makePayload())
      ).rejects.toThrow("credentials");
    });

    it("rejects IPv6 loopback", async () => {
      const sender = new WebhookSender();
      await expect(
        sender.send("https://[::1]/webhook", secret, makePayload())
      ).rejects.toThrow("localhost");
    });

    it("rejects IPv6 private (fd00::)", async () => {
      const sender = new WebhookSender();
      await expect(
        sender.send("https://[fd00::1]/webhook", secret, makePayload())
      ).rejects.toThrow("private");
    });

    it("rejects cloud metadata endpoint", async () => {
      const sender = new WebhookSender();
      await expect(
        sender.send("https://169.254.169.254/latest/meta-data/", secret, makePayload())
      ).rejects.toThrow("private");
    });
  });

  it("body is valid JSON with correct payload", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200 });
    const payload = makePayload();
    const sender = new WebhookSender();
    await sender.send("https://merchant.com/webhook", secret, payload);
    const body = JSON.parse(mockFetch.mock.calls[0]![1].body);
    expect(body.event).toBe("payment.verified");
    expect(body.data.paymentId).toBe("pay_abc");
    expect(body.data.amount).toBe(499.37);
  });
});
