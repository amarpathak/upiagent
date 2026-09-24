import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EmailMessage } from "../gmail/types.js";
import type { LlmConfig } from "../llm/types.js";
import type { ParsedPayment } from "../llm/schema.js";
import type { EmailClassification, EmailClassifier } from "../classifier/types.js";

vi.mock("../llm/chain.js", () => ({ parsePaymentEmail: vi.fn() }));

import { parsePaymentEmail } from "../llm/chain.js";
import { extractPayment, matchParsedPayment, verifyPayment } from "../verify.js";

const mockParse = vi.mocked(parsePaymentEmail);
const llm: LlmConfig = { provider: "gemini", model: "gemini-2.0-flash", apiKey: "k" };

const creditEmail: EmailMessage = {
  id: "m1",
  subject: "HDFC Bank Alert",
  body: "Rs. 499.37 has been credited. UPI Ref: 412345678901",
  from: "alerts@hdfcbank.net",
  receivedAt: new Date(),
};

function parsed(overrides: Partial<ParsedPayment> = {}): ParsedPayment {
  return {
    amount: 499.37,
    upiReferenceId: "412345678901",
    senderName: "John Doe",
    senderUpiId: "john@ybl",
    bankName: "HDFC",
    timestamp: new Date().toISOString(),
    status: "success",
    rawSubject: "HDFC Bank Alert",
    confidence: 0.9,
    isPaymentEmail: true,
    ...overrides,
  };
}

function classifier(result: Partial<EmailClassification> | Error): EmailClassifier & { classify: ReturnType<typeof vi.fn> } {
  return {
    name: "fake",
    classify:
      result instanceof Error
        ? vi.fn().mockRejectedValue(result)
        : vi.fn().mockResolvedValue({
            kind: "credit",
            creditProbability: 0.95,
            suspicionProbability: 0.01,
            source: "jev",
            ...result,
          }),
  };
}

describe("classifier gate", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips the LLM when the classifier says it is not a credit", async () => {
    const c = classifier({ kind: "debit", creditProbability: 0.02 });
    const result = await verifyPayment(creditEmail, { llm, expected: { amount: 499.37 }, classifier: c });

    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe("NOT_PAYMENT_EMAIL");
    expect(result.classification?.kind).toBe("debit");
    expect(mockParse).not.toHaveBeenCalled();
  });

  it("does not spend a classifier call on emails the free regex gate already rejects", async () => {
    const c = classifier({});
    await verifyPayment(
      { ...creditEmail, from: "newsletter@shop.example", body: "Big sale this weekend!" },
      { llm, expected: { amount: 1 }, classifier: c },
    );
    expect(c.classify).not.toHaveBeenCalled();
    expect(mockParse).not.toHaveBeenCalled();
  });

  it("fails open: a classifier error still lets a real payment verify", async () => {
    mockParse.mockResolvedValueOnce(parsed());
    const result = await verifyPayment(creditEmail, {
      llm,
      expected: { amount: 499.37 },
      classifier: classifier(new Error("Jev returned HTTP 503")),
    });
    expect(result.verified).toBe(true);
  });

  it("honours a custom threshold", async () => {
    mockParse.mockResolvedValueOnce(parsed());
    const result = await verifyPayment(creditEmail, {
      llm,
      expected: { amount: 499.37 },
      classifier: classifier({ creditProbability: 0.3 }),
      minCreditProbability: 0.25,
    });
    expect(result.verified).toBe(true);
  });

  it("treats high suspicion as a confidence signal, not a verdict", async () => {
    mockParse.mockResolvedValueOnce(parsed({ confidence: 0.95 }));
    const extraction = await extractPayment(creditEmail, { llm, classifier: classifier({ suspicionProbability: 0.9 }) });
    expect(extraction.status).toBe("extracted");
    if (extraction.status === "extracted") expect(extraction.payment.confidence).toBe(0.6);
  });
});

describe("parse once, match many", () => {
  beforeEach(() => vi.clearAllMocks());

  it("extracts once and matches against several pending payments without further LLM calls", async () => {
    mockParse.mockResolvedValueOnce(parsed());
    const extraction = await extractPayment(creditEmail, { llm });
    expect(extraction.status).toBe("extracted");
    if (extraction.status !== "extracted") return;

    const pending = [100, 250.5, 499.37];
    const results = [];
    for (const amount of pending) {
      results.push(await matchParsedPayment(extraction.payment, creditEmail, { expected: { amount } }));
    }

    expect(mockParse).toHaveBeenCalledTimes(1);
    expect(results.map((r) => r.verified)).toEqual([false, false, true]);
  });

  it("does not let one match mutate the extracted payment used for the next", async () => {
    mockParse.mockResolvedValueOnce(parsed());
    const extraction = await extractPayment(creditEmail, { llm });
    if (extraction.status !== "extracted") throw new Error("expected extraction");
    const before = { ...extraction.payment };

    await matchParsedPayment(extraction.payment, creditEmail, { expected: { amount: 499.37 }, preset: "demo" });
    expect(extraction.payment).toEqual(before);
  });
});
