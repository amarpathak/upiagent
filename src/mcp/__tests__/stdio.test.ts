import { describe, it, expect, vi, beforeEach } from "vitest";
import { PassThrough } from "node:stream";
import { createMcpServer, runStdioServer, createClientBackend, ToolError, UPIAGENT_TOOLS, type UpiAgentBackend } from "../index.js";
import { UpiAgent } from "../../client.js";

async function exchange(lines: string[], ctx: UpiAgentBackend) {
  const input = new PassThrough();
  const output = new PassThrough();
  const chunks: string[] = [];
  output.on("data", (c) => chunks.push(String(c)));

  const server = createMcpServer<UpiAgentBackend>({ name: "upiagent", version: "t", tools: UPIAGENT_TOOLS });
  const done = runStdioServer({ server, ctx, input, output, protectStdout: false });
  for (const line of lines) input.write(`${line}\n`);
  input.end();
  await done;

  return chunks.join("").split("\n").filter(Boolean).map((l) => JSON.parse(l));
}

describe("stdio transport", () => {
  it("answers requests line by line and stays silent for notifications", async () => {
    const out = await exchange(
      [
        JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } }),
        JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
        "",
        JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
      ],
      {} as UpiAgentBackend,
    );
    expect(out.map((m) => m.id).sort()).toEqual([1, 2]);
    expect(out.find((m) => m.id === 2).result.tools).toHaveLength(6);
  });

  it("reports unparseable lines as JSON-RPC parse errors and keeps going", async () => {
    const out = await exchange(["{not json", JSON.stringify({ jsonrpc: "2.0", id: 7, method: "ping" })], {} as UpiAgentBackend);
    expect(out).toContainEqual({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } });
    expect(out).toContainEqual({ jsonrpc: "2.0", id: 7, result: {} });
  });

  it("writes exactly one line per response", async () => {
    const out = await exchange([JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" })], {} as UpiAgentBackend);
    expect(out).toHaveLength(1);
  });
});

describe("client backend", () => {
  const realFetch = globalThis.fetch;
  const fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  beforeEach(() => {
    fetchMock.mockReset();
  });

  const backend = createClientBackend(new UpiAgent({ apiKey: "upi_ak_test", baseUrl: "https://api.test" }), "https://api.test");

  it("passes API error messages through as tool errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "Payment is verified; only pending payments can be cancelled." }) });
    const err = await backend.cancelPayment("p1").catch((e) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect(err.message).toBe("Payment is verified; only pending payments can be cancelled.");
  });

  it("labels server errors", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502, json: async () => ({ error: "Could not read the screenshot." }) });
    expect((await backend.getUsage().catch((e) => e)).message).toBe("upiagent API error (502): Could not read the screenshot.");
  });

  it("explains network failures", async () => {
    // Real fetch against a closed local port — what an outage actually looks like.
    fetchMock.mockImplementation((...args: Parameters<typeof fetch>) => realFetch(...args));
    const offline = createClientBackend(new UpiAgent({ apiKey: "upi_ak_test", baseUrl: "http://127.0.0.1:9" }), "http://127.0.0.1:9");
    const err = await offline.getUsage().catch((e) => e);
    expect(err).toBeInstanceOf(ToolError);
    expect(err.message).toMatch(/Could not reach the upiagent API at http:\/\/127.0.0.1:9/);
  });

  it("builds list queries from only the provided options", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ payments: [], hasMore: false, nextCursor: null }) });
    await backend.listPayments({ status: "claimed", limit: 5 });
    expect(fetchMock.mock.calls[0]![0]).toBe("https://api.test/api/v1/payments?status=claimed&limit=5");
  });
});
