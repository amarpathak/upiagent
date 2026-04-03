/**
 * LLM Parser Tests
 *
 * Testing AI systems is different from testing deterministic code.
 * The LLM won't give the exact same output every time, so we can't do:
 *   expect(result.amount).toBe(499)
 * in a unit test against the real LLM (it might return 499.00 or 499.0).
 *
 * Instead, we test in layers:
 *
 * 1. SCHEMA TESTS — Does the Zod schema accept valid data and reject bad data?
 *    These are deterministic, fast, and test our validation logic.
 *
 * 2. PROMPT TESTS — Does the prompt template fill correctly?
 *    These verify our template has no placeholder bugs.
 *
 * 3. INTEGRATION TESTS (not here) — Does the full chain work with a real LLM?
 *    These require API keys and cost money. We'll run them manually.
 *
 * FDE pattern: For production AI systems, you'd also have:
 * - Eval suites (run 100 test emails, measure accuracy %)
 * - LangSmith tracing (see exactly what the LLM received and returned)
 * - Regression tests (save known-good outputs, alert when they drift)
 */

import { describe, it, expect } from "vitest";
import { parsedPaymentSchema } from "../src/llm/schema.js";
import { paymentExtractionPrompt } from "../src/llm/prompts.js";

describe("ParsedPayment Schema", () => {
  it("accepts valid payment data", () => {
    const validPayment = {
      amount: 499.0,
      upiReferenceId: "412345678901",
      senderName: "John Doe",
      senderUpiId: "john@ybl",
      bankName: "HDFC Bank",
      timestamp: "2024-01-15T10:30:00",
      status: "success" as const,
      rawSubject: "Alert : Update on your HDFC Bank A/c XX1234",
      confidence: 0.95,
      isPaymentEmail: true,
    };

    const result = parsedPaymentSchema.safeParse(validPayment);
    expect(result.success).toBe(true);
  });

  it("rejects negative amounts", () => {
    const badPayment = {
      amount: -499,
      upiReferenceId: "412345678901",
      senderName: "",
      senderUpiId: "",
      bankName: "HDFC",
      timestamp: "",
      status: "success" as const,
      rawSubject: "test",
      confidence: 0.5,
      isPaymentEmail: true,
    };

    const result = parsedPaymentSchema.safeParse(badPayment);
    expect(result.success).toBe(false);
  });

  it("rejects invalid status values", () => {
    const badPayment = {
      amount: 499,
      upiReferenceId: "412345678901",
      senderName: "",
      senderUpiId: "",
      bankName: "HDFC",
      timestamp: "",
      status: "completed", // not in enum
      rawSubject: "test",
      confidence: 0.5,
      isPaymentEmail: true,
    };

    const result = parsedPaymentSchema.safeParse(badPayment);
    expect(result.success).toBe(false);
  });

  it("rejects confidence outside 0-1 range", () => {
    const tooHigh = {
      amount: 499,
      upiReferenceId: "412345678901",
      senderName: "",
      senderUpiId: "",
      bankName: "HDFC",
      timestamp: "",
      status: "success" as const,
      rawSubject: "test",
      confidence: 1.5, // over 1.0
      isPaymentEmail: true,
    };

    const result = parsedPaymentSchema.safeParse(tooHigh);
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric amount (LLM hallucination)", () => {
    // This tests the scenario where the LLM returns a string instead of number.
    // Zod catches it before it enters our system.
    const hallucinated = {
      amount: "four hundred ninety nine",
      upiReferenceId: "412345678901",
      senderName: "",
      senderUpiId: "",
      bankName: "HDFC",
      timestamp: "",
      status: "success",
      rawSubject: "test",
      confidence: 0.5,
      isPaymentEmail: true,
    };

    const result = parsedPaymentSchema.safeParse(hallucinated);
    expect(result.success).toBe(false);
  });

  it("accepts minimal valid data (empty optional strings)", () => {
    // When the LLM can't find sender info, it returns empty strings.
    // The schema should accept this — not all bank emails have sender details.
    const minimal = {
      amount: 100,
      upiReferenceId: "123456789012",
      senderName: "",
      senderUpiId: "",
      bankName: "SBI",
      timestamp: "",
      status: "success" as const,
      rawSubject: "SBI Credit Alert",
      confidence: 0.7,
      isPaymentEmail: true,
    };

    const result = parsedPaymentSchema.safeParse(minimal);
    expect(result.success).toBe(true);
  });
});

describe("Payment Extraction Prompt", () => {
  it("fills template placeholders correctly", async () => {
    // The prompt template has {subject}, {body}, {from} placeholders.
    // This test verifies they get filled correctly — a common bug is
    // mismatched placeholder names between prompt and invoke call.
    const messages = await paymentExtractionPrompt.formatMessages({
      subject: "Alert : HDFC Bank Credit",
      body: "Rs.499.00 credited via UPI. Ref: 412345678901",
      from: "alerts@hdfcbank.net",
    });

    // Should have 2 messages: system + human
    expect(messages).toHaveLength(2);

    // System message should contain our extraction instructions
    const systemContent = messages[0]?.content;
    expect(typeof systemContent === "string" ? systemContent : "").toContain(
      "financial data extraction",
    );

    // Human message should contain the email data
    const humanContent = messages[1]?.content;
    expect(typeof humanContent === "string" ? humanContent : "").toContain("Rs.499.00");
    expect(typeof humanContent === "string" ? humanContent : "").toContain("412345678901");
    expect(typeof humanContent === "string" ? humanContent : "").toContain("alerts@hdfcbank.net");
  });

  it("handles special characters in email body", async () => {
    // Bank emails often have special characters: Rs., ₹, /, etc.
    // The prompt template should pass them through without corruption.
    const messages = await paymentExtractionPrompt.formatMessages({
      subject: "₹499.00 credited",
      body: "A/c XX1234 credited with ₹499.00 via UPI. Ref No: 412345678901 & more details",
      from: "alerts@bank.com",
    });

    const humanContent = messages[1]?.content;
    expect(typeof humanContent === "string" ? humanContent : "").toContain("₹499.00");
    expect(typeof humanContent === "string" ? humanContent : "").toContain("& more details");
  });
});
