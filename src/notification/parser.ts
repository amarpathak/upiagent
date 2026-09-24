/**
 * UPI Notification Parser
 *
 * Parses structured UPI payment notifications from Android apps.
 * Unlike email parsing (which needs LLM), notifications are short
 * and structured enough for regex extraction — no AI cost.
 *
 * Supports: PhonePe, Google Pay, Paytm, BHIM, CRED, Amazon Pay,
 * and generic bank SMS-style notifications.
 */

export interface NotificationData {
  /** Android package name of the source app (e.g. com.phonepe.app) */
  packageName: string;
  /** Notification title */
  title: string;
  /** Notification body text */
  body: string;
  /** When the notification was received (ISO string or epoch ms) */
  receivedAt: string | number;
}

export interface ParsedNotification {
  amount: number;
  senderName: string | null;
  senderUpiId: string | null;
  upiReferenceId: string | null;
  appName: string;
  receivedAt: Date;
  /** Raw notification text for debugging */
  rawText: string;
}

/** Known UPI + bank app package names → display names */
const UPI_APPS: Record<string, string> = {
  // UPI apps
  "com.phonepe.app": "PhonePe",
  "com.google.android.apps.nbu.paisa.user": "Google Pay",
  "net.one97.paytm": "Paytm",
  "in.org.npci.upiapp": "BHIM",
  "com.dreamplug.androidapp": "CRED",
  "in.amazon.mShop.android.shopping": "Amazon Pay",
  "com.whatsapp": "WhatsApp Pay",
  // Bank apps
  "com.csam.icici.bank.imobile": "iMobile Pay",
  "com.sbi.lotusintouch": "YONO SBI",
  "com.axis.mobile": "Axis Mobile",
  "com.snapwork.hdfc": "HDFC PayZapp",
  "com.hdfc.retail.banking": "HDFC Mobile Banking",
  "com.kotak.mobile.banking": "Kotak",
  "com.bob.bob_mbanking": "Bank of Baroda",
  "com.pnbretail.mobilebanking": "PNB",
  "in.yesbank.yesmobile": "Yes Bank",
  "com.indusind.mobilebanking": "IndusInd",
  "com.federalbank.lotza": "Federal Bank",
  // SMS/messaging apps
  "com.google.android.apps.messaging": "Google Messages",
  "com.samsung.android.messaging": "Samsung Messages",
};

/** Check if a package name is a known UPI app */
export function isKnownUpiApp(packageName: string): boolean {
  return packageName in UPI_APPS;
}

// Amount patterns — handles ₹, Rs, Rs., INR prefixes with commas
const AMOUNT_PATTERNS = [
  /(?:₹|Rs\.?|INR)\s*([\d,]+(?:\.\d{1,2})?)/i,
  /(?:received|credited|paid)\s*(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)/i,
  /([\d,]+(?:\.\d{1,2})?)\s*(?:received|credited)/i,
];

// UTR / UPI reference patterns — 12-digit number or alphanumeric ref
const UTR_PATTERNS = [
  /(?:UTR|UPI\s*(?:ref|reference|txn|transaction)\s*(?:no\.?|number|id)?)\s*[:.]?\s*(\w{10,})/i,
  /(?:ref(?:erence)?)\s*(?:no\.?|number|id)?\s*[:.]?\s*(\d{12,})/i,
  /\b(\d{12})\b/, // bare 12-digit number (common UTR format)
];

// Sender name patterns
const SENDER_PATTERNS = [
  /(?:from|by|sender)\s*[:.]?\s*([A-Z][A-Za-z\s]{2,30}?)(?:\s*(?:via|on|$|\.))/i,
  /(?:from)\s+([A-Za-z\s]+?)(?:\s+(?:on|via|for|₹|Rs))/i,
];

// UPI ID patterns
const UPI_ID_PATTERNS = [
  /(?:VPA|UPI\s*ID)\s*[:.]?\s*([\w.-]+@[\w.-]+)/i,
  /([\w.-]+@(?:ybl|upi|axl|okhdfcbank|okicici|oksbi|paytm|apl|ibl|federal))/i,
];

function extractAmount(text: string): number | null {
  for (const pattern of AMOUNT_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const cleaned = match[1].replace(/,/g, "");
      const num = parseFloat(cleaned);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return null;
}

function extractUtr(text: string): string | null {
  for (const pattern of UTR_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function extractSenderName(text: string): string | null {
  for (const pattern of SENDER_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractUpiId(text: string): string | null {
  for (const pattern of UPI_ID_PATTERNS) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].toLowerCase();
  }
  return null;
}

/**
 * Parse a UPI payment notification into structured data.
 * Returns null if the notification doesn't look like a payment.
 */
export function parseNotification(data: NotificationData): ParsedNotification | null {
  const text = `${data.title} ${data.body}`;

  const amount = extractAmount(text);
  if (!amount) return null; // not a payment notification

  const receivedAt = typeof data.receivedAt === "number"
    ? new Date(data.receivedAt)
    : new Date(data.receivedAt);

  if (isNaN(receivedAt.getTime())) return null;

  return {
    amount,
    senderName: extractSenderName(text),
    senderUpiId: extractUpiId(text),
    upiReferenceId: extractUtr(text),
    appName: UPI_APPS[data.packageName]
      || (data.packageName.startsWith("sms:") ? `SMS (${data.packageName.slice(4)})` : data.packageName),
    receivedAt,
    rawText: text,
  };
}
