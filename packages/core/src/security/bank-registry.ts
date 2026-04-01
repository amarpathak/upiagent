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

const customBanks: BankPattern[] = [];

export function registerBankPattern(pattern: BankPattern): void {
  customBanks.push(pattern);
}

export function resetRegistry(): void {
  customBanks.length = 0;
}

export function isKnownBankEmail(
  fromAddress: string
): { known: true; bankName: string } | { known: false } {
  const normalized = fromAddress.toLowerCase().trim();

  for (const bank of [...customBanks, ...BUILTIN_BANKS]) {
    for (const sender of bank.senderPatterns) {
      if (normalized === sender.toLowerCase() || normalized.endsWith(`<${sender.toLowerCase()}>`)) {
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

export function shouldSkipLlm(fromAddress: string, body: string): boolean {
  const senderResult = isKnownBankEmail(fromAddress);
  if (senderResult.known) {
    return false;
  }
  return !hasCurrencyContent(body);
}
