import { describe, it, expect, vi } from "vitest";
import { createMcpServer, ToolError, JSON_RPC, LATEST_PROTOCOL_VERSION, UPIAGENT_TOOLS, UPIAGENT_MCP_INSTRUCTIONS, type UpiAgentBackend } from "../index.js";

const payment = {
  id: "8f5b8f0e-5d4a-4b8e-9a51-2a3c4d5e6f70",
  transactionId: "TXN_abc",
  amount: 499.37,
  note: null,
  status: "pending" as const,
  intentUrl: "upi://pay?pa=shop@ybl&am=499.37",
  qrDataUrl: "data:image/png;base64,AAAA",
  expiresAt: "2026-09-24T18:20:00Z",
  createdAt: "2026-09-24T18:00:00Z",
};

function backend(overrides: Partial<UpiAgentBackend> = {}): UpiAgentBackend {
  return {
    createPayment: vi.fn().mockResolvedValue({ ...payment, intentUrl: payment.intentUrl, qrDataUrl: payment.qrDataUrl, status: "pending", expiresAt: payment.expiresAt }),
    submitProof: vi.fn().mockResolvedValue({ accepted: true, status: "claimed", utr: "412345678901", confidence: 0.9, reasons: ["ok"] }),
    getPayment: vi.fn().mockResolvedValue(payment),
    getEvidence: vi.fn().mockResolvedValue([{ source: "gmail", status: "no_match", confidence: 0.2, createdAt: "2026-09-24T18:01:00Z" }]),
    listPayments: vi.fn().mockResolvedValue({ payments: [payment], hasMore: false, nextCursor: null }),
    cancelPayment: vi.fn().mockResolvedValue({ ...payment, status: "cancelled" }),
    getUsage: vi.fn().mockResolvedValue({ tokensToday: 120, dailyLimit: 20000, remaining: 19880, tier: "platform", resetsAt: "2026-09-25T00:00:00Z" }),
    ...overrides,
  };
}

const onError = vi.fn();
const server = createMcpServer<UpiAgentBackend>({
  name: "upiagent",
  version: "test",
  instructions: UPIAGENT_MCP_INSTRUCTIONS,
  tools: UPIAGENT_TOOLS,
  onError,
});

const call = (name: string, args: unknown, b = backend()) =>
  server.handle({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } }, b);

describe("MCP protocol", () => {
  it("negotiates a supported protocol version and advertises tools", async () => {
    const res = await server.handle(
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "t", version: "1" } } },
      backend(),
    );
    expect(res?.result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "upiagent", version: "test" },
    });
    expect((res?.result as { instructions: string }).instructions).toMatch(/Never deliver goods on a rejected proof/);
  });

  it("answers an unknown protocol version with the latest it supports", async () => {
    const res = await server.handle({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "1999-01-01" } }, backend());
    expect((res?.result as { protocolVersion: string }).protocolVersion).toBe(LATEST_PROTOCOL_VERSION);
  });

  it("does not reply to notifications", async () => {
    expect(await server.handle({ jsonrpc: "2.0", method: "notifications/initialized" }, backend())).toBeNull();
  });

  it("returns JSON-RPC errors for bad messages and unknown methods", async () => {
    expect((await server.handle({ hello: "world" }, backend()))?.error?.code).toBe(JSON_RPC.INVALID_REQUEST);
    expect((await server.handle({ jsonrpc: "2.0", id: 2, method: "resources/list" }, backend()))?.error?.code).toBe(JSON_RPC.METHOD_NOT_FOUND);
    expect((await call("nope", {}))?.error?.code).toBe(JSON_RPC.INVALID_PARAMS);
  });

  it("responds to ping", async () => {
    expect((await server.handle({ jsonrpc: "2.0", id: "p", method: "ping" }, backend()))?.result).toEqual({});
  });
});

describe("tools/list", () => {
  it("publishes six prefixed tools with object JSON Schemas and annotations", () => {
    expect(server.tools.map((t) => t.name)).toEqual([
      "upiagent_create_payment",
      "upiagent_submit_payment_proof",
      "upiagent_get_payment_status",
      "upiagent_list_payments",
      "upiagent_cancel_payment",
      "upiagent_get_usage",
    ]);
    for (const t of server.tools) {
      expect(t.inputSchema.type).toBe("object");
      expect(t.outputSchema.type).toBe("object");
      expect(t.inputSchema).not.toHaveProperty("$schema");
      expect(t.description.length).toBeGreaterThan(40);
    }
    const byName = Object.fromEntries(server.tools.map((t) => [t.name, t]));
    expect(byName.upiagent_get_payment_status!.annotations.readOnlyHint).toBe(true);
    expect(byName.upiagent_cancel_payment!.annotations.destructiveHint).toBe(true);
    expect(byName.upiagent_submit_payment_proof!.description).toMatch(/do NOT deliver the goods/);
  });
});

describe("tools/call", () => {
  it("returns structuredContent plus a JSON text block", async () => {
    const res = await call("upiagent_get_usage", {});
    const result = res?.result as { structuredContent: unknown; content: { type: string; text: string }[] };
    expect(result.structuredContent).toMatchObject({ remaining: 19880, tier: "platform" });
    expect(JSON.parse(result.content[0]!.text)).toEqual(result.structuredContent);
  });

  it("applies input defaults and omits the QR unless asked", async () => {
    const b = backend();
    const res = await call("upiagent_create_payment", { amount: 499 }, b);
    expect(b.createPayment).toHaveBeenCalledWith({ amount: 499, note: undefined, addPaisa: true });
    const out = (res?.result as { structuredContent: Record<string, unknown> }).structuredContent;
    expect(out.paymentId).toBe(payment.id);
    expect(out).not.toHaveProperty("qrDataUrl");
  });

  it("strips the QR image from payment status to save agent context", async () => {
    const res = await call("upiagent_get_payment_status", { paymentId: payment.id });
    const out = (res?.result as { structuredContent: { payment: Record<string, unknown>; evidence: unknown[] } }).structuredContent;
    expect(out.payment).not.toHaveProperty("qrDataUrl");
    expect(out.evidence).toHaveLength(1);
  });

  it("reports invalid arguments as a tool error the agent can fix", async () => {
    const res = await call("upiagent_create_payment", { amount: 0 });
    expect(res?.result).toMatchObject({ isError: true });
    expect((res?.result as { content: { text: string }[] }).content[0]!.text).toMatch(/^Invalid arguments — amount:/);
  });

  it("passes ToolError messages through and hides unexpected ones", async () => {
    const known = await call("upiagent_cancel_payment", { paymentId: payment.id }, backend({
      cancelPayment: vi.fn().mockRejectedValue(new ToolError("Payment is verified; only pending payments can be cancelled.")),
    }));
    expect((known?.result as { content: { text: string }[] }).content[0]!.text).toMatch(/only pending payments/);

    const unknown = await call("upiagent_get_usage", {}, backend({ getUsage: vi.fn().mockRejectedValue(new Error("db password=hunter2")) }));
    const text = (unknown?.result as { content: { text: string }[] }).content[0]!.text;
    expect(text).not.toMatch(/hunter2/);
    expect(onError).toHaveBeenCalled();
  });

  it("rejects backend output that breaks the output contract", async () => {
    const res = await call("upiagent_get_usage", {}, backend({ getUsage: vi.fn().mockResolvedValue({ tokensToday: "lots" } as never) }));
    expect(res?.result).toMatchObject({ isError: true });
  });
});
