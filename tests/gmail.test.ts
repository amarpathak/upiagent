/**
 * Gmail Adapter Tests
 *
 * Testing strategy for code that talks to external APIs:
 *
 * We CAN'T test the actual Gmail API calls without credentials — that's
 * integration testing and we'll handle it separately. What we CAN test
 * is all the parsing logic that transforms raw Gmail responses into our
 * clean EmailMessage format.
 *
 * The GmailClient class has private parsing methods. To test them, we
 * access them through the public interface where possible, or we test
 * the parsing logic extracted into testable units.
 *
 * FDE pattern: When you have a class with private methods worth testing,
 * it often means those methods should be their own module. We'll extract
 * the email parser in the next step.
 */

import { describe, it, expect } from "vitest";
import type { EmailMessage } from "../src/gmail/types.js";

describe("Gmail Types", () => {
  it("EmailMessage interface accepts valid bank alert data", () => {
    // This test verifies our type contract makes sense.
    // In TypeScript, if this compiles, the types are correct.
    const message: EmailMessage = {
      id: "18e1234567890abc",
      subject: "Rs.499.00 credited to your account",
      body: "Dear Customer, Rs.499.00 has been credited to your HDFC Bank account XX1234 by UPI. UPI Ref No: 412345678901. - HDFC Bank",
      from: "alerts@hdfcbank.net",
      receivedAt: new Date("2024-01-15T10:30:00Z"),
    };

    expect(message.id).toBe("18e1234567890abc");
    expect(message.subject).toContain("499");
    expect(message.from).toContain("hdfcbank");
    expect(message.receivedAt).toBeInstanceOf(Date);
  });
});

describe("Email Parsing Logic", () => {
  /**
   * We test the HTML stripping and base64 decoding logic by importing
   * the parser module directly. These are the most error-prone parts
   * of the Gmail adapter.
   */

  it("strips HTML tags correctly from bank alert emails", async () => {
    // Import the parser functions we'll extract
    const { stripHtmlTags } = await import("../src/gmail/parser.js");

    const bankAlertHtml = `
      <html>
        <body>
          <div>Dear Customer,</div>
          <p>Rs.499.00 has been credited to your HDFC Bank account XX1234</p>
          <br/>
          <p>UPI Ref No: 412345678901</p>
          <p>&amp; more details at netbanking</p>
        </body>
      </html>
    `;

    const text = stripHtmlTags(bankAlertHtml);

    expect(text).toContain("Rs.499.00");
    expect(text).toContain("412345678901");
    expect(text).toContain("& more details"); // &amp; decoded
    expect(text).not.toContain("<html>");
    expect(text).not.toContain("<div>");
  });

  it("decodes Gmail base64url encoding", async () => {
    const { decodeBase64Url } = await import("../src/gmail/parser.js");

    // Gmail uses base64url encoding (RFC 4648):
    // - replaces + with -
    // - replaces / with _
    // Standard base64 of "Hello, World!" is "SGVsbG8sIFdvcmxkIQ=="
    // base64url version: "SGVsbG8sIFdvcmxkIQ=="  (no change here, but
    // strings with + or / would differ)
    const encoded = Buffer.from("Rs.499.00 credited via UPI").toString("base64url");
    const decoded = decodeBase64Url(encoded);

    expect(decoded).toBe("Rs.499.00 credited via UPI");
  });

  it("handles empty or missing body gracefully", async () => {
    const { stripHtmlTags, decodeBase64Url } = await import("../src/gmail/parser.js");

    expect(stripHtmlTags("")).toBe("");
    expect(decodeBase64Url("")).toBe("");
  });

  it("collapses excessive whitespace from HTML-heavy emails", async () => {
    const { stripHtmlTags } = await import("../src/gmail/parser.js");

    // Some bank emails have tons of empty divs for spacing
    const messyHtml = `
      <div></div><div></div><div></div>
      <div>Payment of Rs.1000 received</div>
      <div></div><div></div><div></div>
      <div>UPI Ref: 412345678901</div>
    `;

    const text = stripHtmlTags(messyHtml);

    // Should not have more than 2 consecutive newlines
    expect(text).not.toMatch(/\n{3,}/);
    expect(text).toContain("Rs.1000");
    expect(text).toContain("412345678901");
  });
});
