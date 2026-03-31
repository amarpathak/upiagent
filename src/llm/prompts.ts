/**
 * Prompt Templates for Payment Extraction
 *
 * This is the "brain" of upiagent — the instructions that tell the LLM
 * how to read a bank alert email and extract structured payment data.
 *
 * Prompt engineering principles used here:
 *
 * 1. ROLE SETTING — Tell the LLM what it is ("You are a financial data extraction
 *    specialist"). This focuses its behavior on accuracy over creativity.
 *
 * 2. FEW-SHOT EXAMPLES — Show the LLM real bank email examples and the correct
 *    extraction. This is dramatically more effective than just describing what
 *    to do. The LLM learns the pattern from examples.
 *
 * 3. EDGE CASE HANDLING — Explicitly tell the LLM what to do with ambiguous
 *    situations. Without this, it guesses (and guesses wrong for financial data).
 *
 * 4. OUTPUT FORMAT — The Zod schema handles this via LangChain's structured output,
 *    but we reinforce it in the prompt for reliability.
 *
 * FDE insight: Prompt engineering for data extraction is a core skill. Every client
 * project that uses LLMs for structured data will need carefully crafted prompts.
 * The difference between a demo and production is the edge case handling.
 */

import { ChatPromptTemplate } from "@langchain/core/prompts";

/**
 * System prompt — sets the LLM's role and behavior rules.
 *
 * Why a system prompt? Most LLMs treat system prompts as high-priority
 * instructions that shape all subsequent responses. It's like giving
 * the LLM a job description before showing it the work.
 */
const SYSTEM_PROMPT = `You are a financial data extraction specialist for Indian UPI (Unified Payments Interface) transactions.

Your job is to parse bank alert emails and extract structured payment data with HIGH ACCURACY. This data is used for payment verification — errors could mean accepting fraudulent payments or rejecting legitimate ones.

RULES:
1. Extract ONLY what is explicitly stated in the email. Do NOT infer or guess missing data.
2. If a field is not found in the email, return an empty string (for strings) or the specified default.
3. For the amount, extract the TRANSACTION amount, not the account balance.
4. The UPI reference ID is always numeric, typically 12 digits. Do not confuse it with account numbers.
5. Set isPaymentEmail to true ONLY for incoming payment (credit) notifications.
   - Debit alerts, OTPs, promotional emails, account statements → isPaymentEmail: false
6. Be conservative with confidence scores. If any key field (amount, UPI ref) is ambiguous, lower the confidence.

BANK EMAIL FORMAT EXAMPLES:

HDFC Bank:
  Subject: "Alert : Update on your HDFC Bank A/c XX1234"
  Body: "Rs.499.00 has been credited to your A/c XX1234 by a UPI txn on 15-01-24. UPI Ref No 412345678901."

SBI:
  Subject: "SBI Credit Alert"
  Body: "Your A/c X1234 credited by Rs.499.00 on 15-01-24 by ref no 412345678901."

ICICI Bank:
  Subject: "Transaction alert for your Account"
  Body: "Dear Customer, INR 499.00 is credited to your account 1234 on Jan 15, 2024. UPI Ref: 412345678901."

Kotak:
  Subject: "Kotak Bank Credit Alert"
  Body: "Dear Customer, Rs 499/- received in your A/c ending 1234 via UPI on 15/01/2024. RefID: 412345678901"

PhonePe / Google Pay / Paytm (UPI apps):
  Subject: "Payment received"
  Body: "You received Rs.499 from John Doe (john@ybl). Transaction ID: 412345678901"`;

/**
 * The main extraction prompt template.
 *
 * LangChain's ChatPromptTemplate uses {variable} placeholders that get
 * filled at runtime. This lets us reuse the same prompt structure for
 * every email.
 *
 * The template has two messages:
 * - system: The role and rules (above)
 * - human: The actual email to parse (injected at runtime)
 */
export const paymentExtractionPrompt = ChatPromptTemplate.fromMessages([
  ["system", SYSTEM_PROMPT],
  [
    "human",
    `Parse the following bank alert email and extract the payment data.

EMAIL SUBJECT: {subject}

EMAIL BODY:
{body}

EMAIL FROM: {from}

Extract all payment fields. If this is not a payment credit email, set isPaymentEmail to false and fill other fields with defaults.`,
  ],
]);
