import { describe, it, expect, vi, beforeEach } from "vitest";
import { UpiAgent, UpiAgentApiError } from "../client.js";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function reply(status: number, body: unknown) {
  mockFetch.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => body });
}

const created = {
  id: "p1",
  transactionId: "TXN_1",
  amount: 499.37,
  intentUrl: "upi://pay?pa=shop@ybl",
  qrDataUrl: "data:image/png;base64,AA",
  status: "pending",
  expiresAt: "2026-09-24T18:00:00Z",
  createdAt: "2026-09-24T17:40:00Z",
};

describe("UpiAgent client", () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it("sends the API key and returns a contract-valid payment", async () => {
    reply(201, created);
    const upi = new UpiAgent({ apiKey: "upi_ak_test", baseUrl: "https://api.example.com/" });
    const payment = await upi.createPayment({ amount: 499, addPaisa: true });

    expect(payment).toEqual(created);
    const [url, init] = mockFetch.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/api/v1/payments");
    expect(init.headers.Authorization).toBe("Bearer upi_ak_test");
  });

  it("rejects a response that breaks the contract instead of casting it", async () => {
    reply(201, { ...created, status: "paid" });
    const upi = new UpiAgent({ apiKey: "k" });
    await expect(upi.createPayment({ amount: 1 })).rejects.toThrow(/Unexpected response shape/);
  });

  it("surfaces the API error message and status", async () => {
    reply(429, { error: "Daily LLM token limit reached." });
    const upi = new UpiAgent({ apiKey: "k" });
    const err = await upi.verify("p1").catch((e) => e);
    expect(err).toBeInstanceOf(UpiAgentApiError);
    expect(err.status).toBe(429);
    expect(err.message).toBe("Daily LLM token limit reached.");
  });

  it("handles non-JSON error bodies", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new SyntaxError("bad"); } });
    const upi = new UpiAgent({ apiKey: "k" });
    await expect(upi.getStatus("p1")).rejects.toThrow("API error: 502");
  });

  it("encodes payment IDs in the path", async () => {
    reply(200, { ...created, note: null });
    const upi = new UpiAgent({ apiKey: "k", baseUrl: "https://api.example.com" });
    await upi.getStatus("../admin");
    expect(mockFetch.mock.calls[0]![0]).toBe("https://api.example.com/api/v1/payments/..%2Fadmin");
  });
});
