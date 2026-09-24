import { describe, it, expect, vi, beforeEach } from "vitest";
import type { EmailMessage } from "../../gmail/types.js";

vi.mock("../../llm/chain.js", () => ({ parsePaymentEmail: vi.fn() }));
import { parsePaymentEmail } from "../../llm/chain.js";
import { confirmPaymentByUtr } from "../utr.js";

const mockParse = vi.mocked(parsePaymentEmail);
const llm = { provider: "anthropic" as const, model: "claude-haiku-4-5-20251001", apiKey: "k" };
const expected = { utr: "412345678901", amount: 499.37, notBefore: new Date("2026-09-24T12:00:00Z") };

// An HTML-ish template whose text doesn't match exactly (reference split by markup).
const htmlEmail: EmailMessage = {
  id: "html",
  subject: "Transaction alert",
  from: "alerts@hdfcbank.net",
  body: "Amount: INR 499.37 | Type: CR | Ref: 4123 4567 8901",
  receivedAt: new Date("2026-09-24T12:03:00Z"),
  authResults: "dkim=pass; spf=pass; dmarc=pass",
};

const parsed = (o: Record<string, unknown> = {}) => ({
  amount: 499.37,
  upiReferenceId: "412345678901",
  senderName: "Priya",
  senderUpiId: "priya@okhdfcbank",
  bankName: "HDFC",
  timestamp: "2026-09-24T12:02:00Z",
  status: "success" as const,
  rawSubject: "Transaction alert",
  confidence: 0.9,
  isPaymentEmail: true,
  ...o,
});

const gmailWith = (...emails: EmailMessage[]) => ({ findBankAlertsContaining: vi.fn().mockResolvedValue(emails) });

describe("confirmPaymentByUtr — LLM fallback", () => {
  beforeEach(() => {
    mockParse.mockReset();
  });

  it("confirms via the LLM when the trusted email's text can't be matched exactly", async () => {
    mockParse.mockResolvedValue(parsed());
    const r = await confirmPaymentByUtr(gmailWith(htmlEmail), expected, { llm });
    expect(r).toMatchObject({ confirmed: true, method: "llm", emailId: "html" });
  });

  it("still requires the LLM's UTR and amount to equal the expected ones", async () => {
    mockParse.mockResolvedValue(parsed({ upiReferenceId: "412345678902" }));
    expect((await confirmPaymentByUtr(gmailWith(htmlEmail), expected, { llm })).confirmed).toBe(false);
    mockParse.mockResolvedValue(parsed({ amount: 499.3 }));
    expect((await confirmPaymentByUtr(gmailWith(htmlEmail), expected, { llm })).confirmed).toBe(false);
  });

  it("never asks the LLM about untrusted or out-of-window emails", async () => {
    await confirmPaymentByUtr(gmailWith({ ...htmlEmail, authResults: "dkim=fail; dmarc=fail" }), expected, { llm });
    await confirmPaymentByUtr(gmailWith({ ...htmlEmail, from: "alerts@hdfc-secure.co" }), expected, { llm });
    await confirmPaymentByUtr(gmailWith({ ...htmlEmail, receivedAt: new Date("2026-09-23T12:00:00Z") }), expected, { llm });
    expect(mockParse).not.toHaveBeenCalled();
  });

  it("does not use the LLM when none is configured", async () => {
    const r = await confirmPaymentByUtr(gmailWith(htmlEmail), expected);
    expect(r.confirmed).toBe(false);
    expect(mockParse).not.toHaveBeenCalled();
  });
});
