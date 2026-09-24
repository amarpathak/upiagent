/**
 * Confirm a payment by its UTR against the merchant's bank emails — with no
 * LLM. The UTR (from the customer's screenshot, or typed by them) is the join
 * key: a genuine bank credit alert that contains that exact UTR and that exact
 * amount, sent after the payment request existed and authenticated by DKIM or
 * DMARC, settles the payment as `verified`.
 *
 * Why this can't be satisfied by a forged screenshot: the screenshot only
 * supplies the UTR to look for. The proof is the bank's own email, which the
 * customer cannot write.
 */
import type { EmailMessage } from "../gmail/types.js";
import type { GmailClient } from "../gmail/client.js";
import { hasCreditContent, isKnownBankEmail, extractEmailAddress } from "../security/bank-registry.js";
import { checkEmailAuth } from "../security/email-auth.js";
import { parsePaymentEmail } from "../llm/chain.js";
import type { LlmConfig } from "../llm/types.js";
import type { CostTracker } from "../utils/cost.js";

export interface UtrExpectation {
  /** Normalised 12-digit UTR. */
  utr: string;
  /** Exact amount the customer was asked to pay (including added paise). */
  amount: number;
  /** When the payment request was created; earlier emails can't be for it. */
  notBefore: Date;
  /** Merchant-specific bank sender addresses, in addition to the built-in registry. */
  customBankSenders?: string[];
}

export interface UtrCheck {
  confirmed: boolean;
  reasons: string[];
  /**
   * Which check failed. Only text-reading checks ("utr" | "amount" | "credit")
   * may fall back to LLM extraction; trust checks ("sender" | "auth" |
   * "time") never do.
   */
  failedAt?: "sender" | "auth" | "utr" | "credit" | "amount" | "time";
}

/** Clock skew between the bank's mail server and ours. */
const TIME_SLACK_MS = 2 * 60_000;

/**
 * True when `amount` appears in `text` exactly — paise included and not as
 * part of a larger number. Accepts 1299.06, 1,299.06 and Indian 1,00,000.50
 * styles; a whole amount may also appear without decimals.
 */
export function containsExactAmount(text: string, amount: number): boolean {
  const fixed = amount.toFixed(2);
  const [intPart, paise] = fixed.split(".") as [string, string];
  const western = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const indian =
    intPart.length > 3
      ? intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + intPart.slice(-3)
      : intPart;
  const ints = [...new Set([intPart, western, indian])];
  const forms = ints.map((i) => `${i}\\.${paise}`);
  if (paise === "00") forms.push(...ints.map((i) => `${i}(?!\\.\\d)`));
  // Not preceded by a digit, nor by "digit + separator" (so "Rs.499.37" matches
  // but "1499.37" and "1,499.37" don't); not followed by another digit.
  const pattern = new RegExp(`(?<!\\d)(?<!\\d[.,])(?:${forms.join("|")})(?!\\d)`);
  return pattern.test(text.replace(/\u00a0/g, " "));
}

/** Deterministic check of one email against the expected UTR payment. */
export function checkBankEmailForUtr(email: EmailMessage, expected: UtrExpectation): UtrCheck {
  const reasons: string[] = [];
  const fail = (reason: string, failedAt: NonNullable<UtrCheck["failedAt"]>): UtrCheck => ({
    confirmed: false,
    reasons: [...reasons, reason],
    failedAt,
  });

  const sender = extractEmailAddress(email.from);
  const custom = (expected.customBankSenders ?? []).map((s) => s.trim().toLowerCase());
  if (!isKnownBankEmail(email.from).known && !custom.includes(sender)) {
    return fail(`Sender ${sender} is not a known bank.`, "sender");
  }

  if (!email.authResults) return fail("No Authentication-Results header; sender cannot be authenticated.", "auth");
  const auth = checkEmailAuth(email.authResults);
  if (!auth.passed) return fail(auth.details, "auth");
  reasons.push(`Bank sender ${sender}, ${auth.details.toLowerCase()}.`);

  if (email.receivedAt.getTime() < expected.notBefore.getTime() - TIME_SLACK_MS) {
    return fail("Email predates the payment request.", "time");
  }
  reasons.push("Received after the payment request was created.");

  const text = `${email.subject}\n${email.body}`;
  // Exact 12-digit token: not part of a longer number (account/phone digits).
  if (!new RegExp(`(?<!\\d)${expected.utr}(?!\\d)`).test(text)) {
    return fail(`Email does not contain UTR ${expected.utr}.`, "utr");
  }
  reasons.push(`Contains UTR ${expected.utr}.`);

  if (!hasCreditContent(text)) return fail("Email is not a credit (money received) alert.", "credit");
  if (!containsExactAmount(text, expected.amount)) {
    return fail(`Email does not show the exact amount ₹${expected.amount.toFixed(2)}.`, "amount");
  }
  reasons.push(`Credit of exactly ₹${expected.amount.toFixed(2)}.`);

  return { confirmed: true, reasons };
}

export interface UtrConfirmation extends UtrCheck {
  /** Gmail message id of the confirming email. */
  emailId?: string;
  emailsChecked: number;
  /** "text" = exact match in the email; "llm" = read by the LLM fallback. */
  method?: "text" | "llm";
}

const TEXT_CHECKS = new Set<UtrCheck["failedAt"]>(["utr", "amount", "credit"]);

/**
 * When a trusted, in-window bank email fails only because its text couldn't
 * be read deterministically (HTML-heavy templates, unusual labels), ask the
 * LLM to extract it — then require the extracted UTR and amount to equal the
 * expected ones exactly. The LLM reads; the comparison still decides.
 */
async function llmConfirm(
  email: EmailMessage,
  expected: UtrExpectation,
  prior: UtrCheck,
  llm: LlmConfig,
  costTracker?: CostTracker,
): Promise<UtrCheck> {
  const parsed = await parsePaymentEmail(
    email,
    llm,
    costTracker ? { callbacks: [costTracker.asLangChainHandler()] } : undefined,
  );
  const base = prior.reasons.slice(0, -1);
  if (!parsed?.isPaymentEmail || parsed.status !== "success") {
    return { confirmed: false, reasons: [...base, "LLM: not a successful credit alert."], failedAt: "credit" };
  }
  if (parsed.upiReferenceId.replace(/\D/g, "") !== expected.utr) {
    return { confirmed: false, reasons: [...base, `LLM read UTR ${parsed.upiReferenceId}, not ${expected.utr}.`], failedAt: "utr" };
  }
  if (Math.abs(parsed.amount - expected.amount) > 0.005) {
    return { confirmed: false, reasons: [...base, `LLM read amount ₹${parsed.amount}, not ₹${expected.amount.toFixed(2)}.`], failedAt: "amount" };
  }
  return { confirmed: true, reasons: [...base, `LLM read UTR ${expected.utr} and exactly ₹${expected.amount.toFixed(2)}.`] };
}

/**
 * Searches the merchant's inbox for bank alerts containing the UTR and returns
 * the first that passes every check. One Gmail search; the LLM runs only as a
 * fallback on a trusted email whose text couldn't be matched exactly, and only
 * when `llm` is given.
 */
export async function confirmPaymentByUtr(
  gmail: Pick<GmailClient, "findBankAlertsContaining">,
  expected: UtrExpectation,
  options: { lookbackMinutes?: number; llm?: LlmConfig; costTracker?: CostTracker } = {},
): Promise<UtrConfirmation> {
  if (!/^\d{12}$/.test(expected.utr)) {
    return { confirmed: false, reasons: ["UTR must be 12 digits."], emailsChecked: 0 };
  }
  const lookbackMinutes =
    options.lookbackMinutes ?? Math.min(Math.ceil((Date.now() - expected.notBefore.getTime()) / 60_000) + 10, 7 * 24 * 60);
  const emails = await gmail.findBankAlertsContaining(expected.utr, { lookbackMinutes });

  let last: UtrCheck = { confirmed: false, reasons: [`No bank email containing UTR ${expected.utr} yet.`] };
  for (const email of emails) {
    const check = checkBankEmailForUtr(email, expected);
    if (check.confirmed) return { ...check, emailId: email.id, emailsChecked: emails.length, method: "text" };
    if (options.llm && TEXT_CHECKS.has(check.failedAt)) {
      const viaLlm = await llmConfirm(email, expected, check, options.llm, options.costTracker);
      if (viaLlm.confirmed) return { ...viaLlm, emailId: email.id, emailsChecked: emails.length, method: "llm" };
      last = viaLlm;
      continue;
    }
    last = check;
  }
  return { ...last, emailsChecked: emails.length };
}
