/**
 * LLM Output Schema
 *
 * This Zod schema is the contract between the LLM and our application.
 * It serves THREE purposes:
 *
 * 1. INSTRUCTION — LangChain converts this schema into instructions that
 *    tell the LLM exactly what fields to extract and what types they must be.
 *    The LLM sees: "amount must be a number, upiReferenceId must be a string
 *    matching 12 digits", etc.
 *
 * 2. VALIDATION — After the LLM responds, Zod parses the response against
 *    this schema. If the LLM returns amount: "four hundred ninety nine" instead
 *    of amount: 499, Zod catches it immediately. This is your first security
 *    layer — catching hallucinations before they enter your system.
 *
 * 3. TYPE INFERENCE — TypeScript infers the ParsedPayment type directly from
 *    this schema. One source of truth for both runtime validation and static types.
 *    This is the "schema-first" pattern — define the shape once, get types for free.
 */

import { z } from "zod/v4";

/**
 * Schema for payment data extracted from a bank alert email.
 *
 * Each field has a .describe() call — this isn't just documentation.
 * LangChain passes these descriptions to the LLM as part of the extraction
 * instructions. Better descriptions = more accurate extraction.
 *
 * FDE pattern: When using LLMs for structured extraction, the schema
 * descriptions are essentially part of your prompt. Treat them like
 * prompt engineering — be specific, give examples, mention edge cases.
 */
export const parsedPaymentSchema = z.object({
  amount: z
    .number()
    .min(0.01)
    .describe(
      "The payment amount in INR (Indian Rupees). Extract the numeric value only, " +
        "no currency symbols. Examples: 499.00, 1000, 25.50. " +
        "If the email mentions multiple amounts (like balance), extract the TRANSACTION amount.",
    ),

  upiReferenceId: z
    .string()
    .describe(
      "The UPI transaction reference number. This is typically a 12-digit numeric string. " +
        "Look for labels like 'UPI Ref', 'Ref No', 'RefID', 'Transaction ID', 'UTR'. " +
        "Example: '412345678901'. Return the digits only, no prefixes.",
    ),

  senderName: z
    .string()
    .describe(
      "The name of the person or entity who sent the payment. " +
        "This might appear as a full name, business name, or UPI ID. " +
        "If not found in the email, return an empty string.",
    ),

  senderUpiId: z
    .string()
    .describe(
      "The UPI ID of the sender (format: name@bankhandle). " +
        "Examples: 'john@ybl', 'shop@paytm', '9876543210@upi'. " +
        "If not found in the email, return an empty string.",
    ),

  bankName: z
    .string()
    .describe(
      "The name of the bank that sent this alert. " +
        "Infer from the sender email or email content. " +
        "Examples: 'HDFC Bank', 'SBI', 'ICICI Bank', 'Kotak Mahindra Bank'.",
    ),

  timestamp: z
    .string()
    .describe(
      "The date and time of the transaction as mentioned in the email, " +
        "in ISO 8601 format (YYYY-MM-DDTHH:mm:ss). " +
        "If only a date is mentioned, use midnight (T00:00:00). " +
        "If no timestamp is found in the email body, return an empty string.",
    ),

  status: z
    .enum(["success", "failed", "pending"])
    .describe(
      "The payment status. Most bank credit alerts indicate 'success'. " +
        "Look for words like 'credited', 'received', 'successful' → 'success'. " +
        "'failed', 'declined', 'rejected' → 'failed'. " +
        "'pending', 'processing', 'in progress' → 'pending'.",
    ),

  rawSubject: z
    .string()
    .describe("The original email subject line, copied exactly as-is."),

  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe(
      "Your confidence in the extraction accuracy, from 0.0 to 1.0. " +
        "1.0 = all fields clearly present in the email. " +
        "0.5 = some fields were inferred or ambiguous. " +
        "Below 0.3 = this might not be a payment email at all.",
    ),

  isPaymentEmail: z
    .boolean()
    .describe(
      "Whether this email is actually a UPI payment credit notification. " +
        "true = this is a payment received/credited alert. " +
        "false = this is something else (debit alert, promo, OTP, statement, etc.). " +
        "Only return true for INCOMING payment (credit) notifications.",
    ),
});

/**
 * TypeScript type inferred from the Zod schema.
 * This is the type the rest of upiagent works with.
 *
 * Using z.infer means we never have to manually keep a TypeScript interface
 * in sync with the Zod schema — they're always identical by definition.
 */
export type ParsedPayment = z.infer<typeof parsedPaymentSchema>;
