import { describe, it, expect, vi } from "vitest";
import { JevClassifier, JevClassifierError } from "../jev.js";
import type { EmailMessage } from "../../gmail/types.js";

const email: EmailMessage = {
  id: "m1",
  subject: "Alert",
  body: "Rs. 499.37 credited to a/c XX12 by john@ybl. UPI Ref 412345678901",
  from: "alerts@hdfcbank.net",
  receivedAt: new Date(),
};

// Shape of POST /v1/systemone as typed by @typesafe-ai/sdk 0.6 (SystemOneResult).
function jevResponse(overrides: { choice?: string; credit?: number; noul?: number } = {}) {
  const credit = overrides.credit ?? 0.93;
  return {
    model: "jev-2026-09",
    answers: {
      kind: {
        type: "choice",
        choice: overrides.choice ?? "credit",
        confidence: 0.93,
        probabilities: { credit, debit: 0.03, otp: 0.01, statement: 0.01, promotional: 0.01, other: 0.01 },
      },
      suspicious: { type: "noul", noul: overrides.noul ?? 0.02 },
    },
    usage: { input_tokens: 212, output_tokens: 0 },
  };
}

function mockFetch(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: async () => body });
}

describe("JevClassifier", () => {
  it("posts the email as state with typed questions, and maps the answer", async () => {
    const fetch = mockFetch(200, jevResponse());
    const jev = new JevClassifier({ apiKey: "ts_test", fetch, baseUrl: "https://api.typesafe.test/" });

    const result = await jev.classify(email);

    expect(result).toEqual({
      kind: "credit",
      creditProbability: 0.93,
      suspicionProbability: 0.02,
      source: "jev",
      usage: { inputTokens: 212, outputTokens: 0 },
    });

    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.typesafe.test/v1/systemone");
    expect(init.headers.Authorization).toBe("Bearer ts_test");
    const sent = JSON.parse(init.body);
    expect(sent.model).toBe("jev-latest");
    expect(sent.state).toEqual({ from: email.from, subject: email.subject, body: email.body });
    expect(sent.questions.kind.type).toBe("choice");
    expect(Object.keys(sent.questions.kind.criteria)).toEqual(["credit", "debit", "otp", "statement", "promotional", "other"]);
    expect(sent.questions.suspicious.type).toBe("noul");
  });

  it("truncates long bodies to bound cost", async () => {
    const fetch = mockFetch(200, jevResponse());
    const jev = new JevClassifier({ apiKey: "k", fetch, maxBodyChars: 10 });
    await jev.classify({ ...email, body: "x".repeat(50) });
    expect(JSON.parse(fetch.mock.calls[0]![1].body).state.body).toHaveLength(10);
  });

  it("throws on HTTP errors without echoing the response body", async () => {
    const jev = new JevClassifier({ apiKey: "k", fetch: mockFetch(401, { error: "bad key ts_secret" }) });
    const err = await jev.classify(email).catch((e) => e);
    expect(err).toBeInstanceOf(JevClassifierError);
    expect(err.status).toBe(401);
    expect(err.message).not.toContain("ts_secret");
  });

  it("rejects a response that does not match the contract", async () => {
    const bad = jevResponse();
    (bad.answers.kind as { choice: string }).choice = "refund";
    const jev = new JevClassifier({ apiKey: "k", fetch: mockFetch(200, bad) });
    await expect(jev.classify(email)).rejects.toThrow("Unexpected Jev response shape");
  });

  it("wraps network failures", async () => {
    const jev = new JevClassifier({ apiKey: "k", fetch: vi.fn().mockRejectedValue(new Error("ECONNRESET")) });
    await expect(jev.classify(email)).rejects.toThrow(/Jev request failed: ECONNRESET/);
  });

  it("requires an API key", () => {
    expect(() => new JevClassifier({ apiKey: "" })).toThrow(JevClassifierError);
  });
});
