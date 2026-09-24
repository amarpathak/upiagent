// packages/core/src/security/bank-registry.ts

export interface BankPattern {
  name: string;
  senderPatterns: string[];
  bodyPatterns: RegExp[];
}

const BUILTIN_BANKS: BankPattern[] = [
  {
    name: "hdfc",
    senderPatterns: ["alerts@hdfcbank.net", "alerts@hdfcbank.bank.in"],
    bodyPatterns: [/Rs\.?\s*[\d,]+\.\d{2}\s+(has been |)credited/i],
  },
  {
    name: "sbi",
    senderPatterns: ["alerts@sbi.co.in", "donotreply@sbi.co.in"],
    bodyPatterns: [/credited by Rs\.?\s*[\d,]+/i],
  },
  {
    name: "icici",
    senderPatterns: ["alerts@icicibank.com"],
    bodyPatterns: [/Rs\.?\s*[\d,]+\.\d{2}\s+credited/i],
  },
  {
    name: "kotak",
    senderPatterns: ["alerts@kotak.com", "alerts@kotakbank.com"],
    bodyPatterns: [/Rs\.?\s*[\d,]+\.\d{2}\s+credited/i],
  },
  {
    name: "axis",
    senderPatterns: ["alerts@axisbank.com"],
    bodyPatterns: [/Rs\.?\s*[\d,]+\.\d{2}\s+(has been |)credited/i],
  },
  {
    name: "bob",
    senderPatterns: ["alerts@bankofbaroda.com"],
    bodyPatterns: [/Rs\.?\s*[\d,]+\.\d{2}\s+credited/i],
  },
  {
    name: "pnb",
    senderPatterns: ["alerts@pnb.co.in"],
    bodyPatterns: [/Rs\.?\s*[\d,]+\.\d{2}\s+credited/i],
  },
  {
    name: "yes-bank",
    senderPatterns: ["alerts@yesbank.in"],
    bodyPatterns: [/Rs\.?\s*[\d,]+\.\d{2}\s+credited/i],
  },
  {
    name: "idbi",
    senderPatterns: ["alerts@idbibank.co.in"],
    bodyPatterns: [/Rs\.?\s*[\d,]+\.\d{2}\s+credited/i],
  },
  {
    name: "federal-bank",
    senderPatterns: ["transactions@fi.money", "alerts@federalbank.co.in"],
    bodyPatterns: [/₹[\d,]+(\.\d{2})?\s*(credited|received)/i, /credited with the following amount/i],
  },
  {
    name: "phonepe",
    senderPatterns: ["noreply@phonepe.com"],
    bodyPatterns: [/received\s+Rs\.?\s*[\d,]+/i, /₹[\d,]+/i],
  },
  {
    name: "gpay",
    senderPatterns: ["noreply@google.com"],
    bodyPatterns: [/received\s+₹[\d,]+/i, /Rs\.?\s*[\d,]+.*received/i],
  },
  {
    name: "paytm",
    senderPatterns: ["noreply@paytm.com", "alerts@paytm.com"],
    bodyPatterns: [/received\s+Rs\.?\s*[\d,]+/i, /₹[\d,]+.*credited/i],
  },
  {
    name: "union-bank",
    senderPatterns: ["alerts@unionbankofindia.co.in"],
    bodyPatterns: [/Rs\.?\s*[\d,]+\.\d{2}\s+credited/i],
  },
  {
    name: "canara",
    senderPatterns: ["alerts@canarabank.com"],
    bodyPatterns: [/Rs\.?\s*[\d,]+\.\d{2}\s+credited/i],
  },
  {
    name: "indian-bank",
    senderPatterns: ["alerts@indianbank.co.in"],
    bodyPatterns: [/Rs\.?\s*[\d,]+\.\d{2}\s+credited/i],
  },
];

/**
 * Human-readable display name for each built-in registry slug. Used to
 * override the LLM's free-text bankName guess with the deterministic
 * sender-match result (see isKnownBankEmail) so the displayed bank always
 * matches the email's actual sender, not a model inference.
 */
const BANK_DISPLAY_NAMES: Record<string, string> = {
  hdfc: "HDFC Bank",
  sbi: "SBI",
  icici: "ICICI Bank",
  kotak: "Kotak Mahindra Bank",
  axis: "Axis Bank",
  bob: "Bank of Baroda",
  pnb: "Punjab National Bank",
  "yes-bank": "Yes Bank",
  idbi: "IDBI Bank",
  "federal-bank": "Federal Bank",
  phonepe: "PhonePe",
  gpay: "Google Pay",
  paytm: "Paytm",
  "union-bank": "Union Bank of India",
  canara: "Canara Bank",
  "indian-bank": "Indian Bank",
};

/** Human-readable display name for a registry slug, falling back to the slug itself for custom banks with no mapping. */
export function getBankDisplayName(slug: string): string {
  return BANK_DISPLAY_NAMES[slug] ?? slug;
}

const customBanks: BankPattern[] = [];

export function registerBankPattern(pattern: BankPattern): void {
  customBanks.push(pattern);
}

export function resetRegistry(): void {
  customBanks.length = 0;
}

/** Extract bare email address from a From header (e.g. "Name <addr>" → "addr") */
export function extractEmailAddress(fromHeader: string): string {
  const match = fromHeader.match(/<([^>]+)>/);
  return (match?.[1] ?? fromHeader).toLowerCase().trim();
}

export function isKnownBankEmail(
  fromAddress: string
): { known: true; bankName: string } | { known: false } {
  const bareEmail = extractEmailAddress(fromAddress);

  for (const bank of [...customBanks, ...BUILTIN_BANKS]) {
    for (const sender of bank.senderPatterns) {
      if (bareEmail === sender.toLowerCase()) {
        return { known: true, bankName: bank.name };
      }
    }
  }

  return { known: false };
}

const CURRENCY_PATTERNS = [
  /Rs\.?\s*[\d,]+/i,
  /INR\s*[\d,]+/i,
  /₹\s*[\d,]+/,
  /credited/i,
  /received/i,
];

export function hasCurrencyContent(body: string): boolean {
  return CURRENCY_PATTERNS.some((pattern) => pattern.test(body));
}

/**
 * Language indicating money moved INTO the account. We only ever verify
 * incoming payments, so an email without one of these is not worth an LLM call.
 */
const CREDIT_PATTERNS = [
  /\bcredited\b/i,
  /\breceived\b/i,
  /\bdeposit(ed)?\b/i,
  /\bpayment\s+received\b/i,
  /\bmoney\s+received\b/i,
  /\badded\s+to\s+your\b/i,
];

/**
 * Language indicating money moved OUT, or an email that is not a transaction
 * at all. These dominate a real inbox: every debit alert, OTP, statement, and
 * marketing mail from a bank previously reached the LLM because the sender was
 * on the known-bank list.
 */
const NON_CREDIT_PATTERNS = [
  /\bdebited\b/i,
  /\bdebit\s+alert\b/i,
  /\bwithdrawn\b/i,
  /\bspent\b/i,
  /\bpurchase\b/i,
  /\bOTP\b/i,
  /\bone[\s-]?time\s+password\b/i,
  /\bstatement\s+(is\s+)?(ready|available|generated)\b/i,
  /\be-?statement\b/i,
  /\bdue\s+date\b/i,
  /\bminimum\s+amount\s+due\b/i,
];

/**
 * True when the body reads as an incoming-credit notification.
 *
 * A debit alert carries currency text too, so currency alone cannot decide
 * this. An explicit debit/OTP/statement marker vetoes the email unless credit
 * language also appears — some banks send a single template covering both
 * directions, and there the credit wording is the signal that matters.
 */
export function hasCreditContent(body: string): boolean {
  const credit = CREDIT_PATTERNS.some((p) => p.test(body));
  if (!credit) return false;

  // Credit language wins only if no non-credit marker contradicts it, or the
  // email leads with the credit (mixed-template case).
  const nonCredit = NON_CREDIT_PATTERNS.some((p) => p.test(body));
  if (!nonCredit) return true;

  const firstCredit = CREDIT_PATTERNS.map((p) => body.search(p)).filter((i) => i >= 0);
  const firstNonCredit = NON_CREDIT_PATTERNS.map((p) => body.search(p)).filter((i) => i >= 0);
  return Math.min(...firstCredit) < Math.min(...firstNonCredit);
}

/**
 * Decides whether an email can skip the LLM entirely.
 *
 * Previously any known bank sender was passed straight through, so every debit
 * alert, OTP, and statement notice from that bank cost a full LLM call. The
 * sender check now only establishes plausibility; the body must still read as
 * an incoming credit before we spend a token on it.
 */
export function shouldSkipLlm(fromAddress: string, body: string): boolean {
  const senderResult = isKnownBankEmail(fromAddress);

  // Known bank: still require credit language, but currency alone is enough
  // when no direction is stated (short templates like "Rs.500.00 - A/c XX12").
  if (senderResult.known) {
    if (hasCreditContent(body)) return false;
    const statesDirection = NON_CREDIT_PATTERNS.some((p) => p.test(body));
    return statesDirection || !hasCurrencyContent(body);
  }

  // Unknown sender: require an explicit credit signal.
  return !hasCreditContent(body);
}
