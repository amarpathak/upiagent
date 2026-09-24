import { describe, it, expect, vi } from "vitest";
import { containsExactAmount, checkBankEmailForUtr, confirmPaymentByUtr } from "../utr.js";
import type { EmailMessage } from "../../gmail/types.js";

const created = new Date("2026-09-24T12:00:00Z");
const expected = { utr: "412345678901", amount: 499.37, notBefore: created };

function email(overrides: Partial<EmailMessage> = {}): EmailMessage {
  return {
    id: "m1",
    subject: "Credit alert",
    from: "HDFC Bank <alerts@hdfcbank.net>",
    body: "Dear Customer, Rs.499.37 has been credited to your a/c XX1234 by VPA priya@okhdfcbank on 24-09-26. UPI Ref No 412345678901.",
    receivedAt: new Date("2026-09-24T12:03:00Z"),
    authResults: "mx.google.com; dkim=pass header.i=@hdfcbank.net; spf=pass; dmarc=pass",
    ...overrides,
  };
}

describe("containsExactAmount", () => {
  it.each([
    ["Rs.499.37 credited", 499.37, true],
    ["INR 1,299.06 received", 1299.06, true],
    ["₹1,00,000.50 credited", 100000.5, true],
    ["Rs 500 credited", 500, true],
    ["Rs 500.00 credited", 500, true],
    ["Rs.499.36 credited", 499.37, false],
    ["Rs.1499.37 credited", 499.37, false], // larger number containing the amount
    ["Rs.499.375 credited", 499.37, false],
    ["Rs 500.50 credited", 500, false],
    ["Rs.499 credited", 499.37, false], // paise must be present
  ])("%s / %s → %s", (text, amount, result) => {
    expect(containsExactAmount(text, amount)).toBe(result);
  });
});

describe("checkBankEmailForUtr", () => {
  it("confirms a genuine credit alert with the exact UTR and amount", () => {
    const r = checkBankEmailForUtr(email(), expected);
    expect(r.confirmed).toBe(true);
    expect(r.reasons.join(" ")).toMatch(/Contains UTR 412345678901/);
  });

  it.each<[string, Partial<EmailMessage>, RegExp]>([
    ["an unknown sender", { from: "alerts@hdfc-bank-secure.com" }, /not a known bank/],
    ["no authentication header", { authResults: undefined }, /cannot be authenticated/],
    ["failed DKIM and DMARC (spoofed)", { authResults: "dkim=fail; spf=pass; dmarc=fail" }, /authentication failed/],
    ["a different UTR", { body: "Rs.499.37 credited. UPI Ref 999999999999" }, /does not contain UTR/],
    ["the UTR inside a longer number", { body: "Rs.499.37 credited. Ref 94123456789012" }, /does not contain UTR/],
    ["a debit alert", { body: "Rs.499.37 debited from a/c XX1234. UPI Ref 412345678901" }, /not a credit/],
    ["a different amount", { body: "Rs.49.37 credited. UPI Ref 412345678901" }, /exact amount/],
    ["an email from before the request", { receivedAt: new Date("2026-09-24T11:00:00Z") }, /predates/],
  ])("rejects %s", (_name, overrides, reason) => {
    const r = checkBankEmailForUtr(email(overrides), expected);
    expect(r.confirmed).toBe(false);
    expect(r.reasons.at(-1)).toMatch(reason);
  });

  it("accepts the merchant's custom bank sender", () => {
    const r = checkBankEmailForUtr(email({ from: "alerts@mycoopbank.in" }), { ...expected, customBankSenders: ["Alerts@MyCoopBank.in"] });
    expect(r.confirmed).toBe(true);
  });
});

describe("confirmPaymentByUtr", () => {
  it("searches once and returns the first email that passes", async () => {
    const gmail = { findBankAlertsContaining: vi.fn().mockResolvedValue([email({ id: "spoof", authResults: "dkim=fail; dmarc=fail" }), email({ id: "real" })]) };
    const r = await confirmPaymentByUtr(gmail, expected, { lookbackMinutes: 60 });
    expect(gmail.findBankAlertsContaining).toHaveBeenCalledWith("412345678901", { lookbackMinutes: 60 });
    expect(r).toMatchObject({ confirmed: true, emailId: "real", emailsChecked: 2 });
  });

  it("reports when no bank email has arrived yet", async () => {
    const r = await confirmPaymentByUtr({ findBankAlertsContaining: vi.fn().mockResolvedValue([]) }, expected);
    expect(r).toMatchObject({ confirmed: false, emailsChecked: 0 });
    expect(r.reasons[0]).toMatch(/No bank email containing UTR/);
  });

  it("refuses a malformed UTR without searching", async () => {
    const gmail = { findBankAlertsContaining: vi.fn() };
    const r = await confirmPaymentByUtr(gmail, { ...expected, utr: "12 OR from:x" });
    expect(r.confirmed).toBe(false);
    expect(gmail.findBankAlertsContaining).not.toHaveBeenCalled();
  });
});
