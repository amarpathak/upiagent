/**
 * UPI Intent URL Builder
 *
 * UPI (Unified Payments Interface) uses a URL scheme to initiate payments.
 * When a phone scans a QR code containing this URL, the UPI app opens
 * with pre-filled payment details.
 *
 * The format is standardized by NPCI (National Payments Corporation of India):
 *   upi://pay?pa=<payee>&pn=<name>&am=<amount>&tn=<note>&tr=<ref>&cu=INR
 *
 * This is an open protocol — no API key, no registration, no payment gateway
 * needed. Any UPI ID can receive payments via these links. That's what makes
 * upiagent possible: you generate the QR, the customer pays via any UPI app
 * (GPay, PhonePe, Paytm, etc.), and you verify via Gmail alerts.
 *
 * FDE insight: UPI handles ~10 billion transactions/month in India. Understanding
 * this protocol is essential for any fintech work in the Indian market.
 */

import type { MerchantConfig, CreatePaymentOptions } from "./types.js";
import { randomBytes } from "crypto";

/**
 * Generates a unique transaction reference ID.
 *
 * Format: TXN_<timestamp>_<random>
 * - Timestamp gives rough ordering
 * - Random suffix prevents collision
 * - Prefix makes it easy to identify in logs
 *
 * We use crypto.randomBytes instead of Math.random because:
 * 1. Math.random is not cryptographically secure
 * 2. For financial transaction IDs, even a small chance of collision
 *    could mean two payments share an ID → verification confusion
 */
export function generateTransactionId(): string {
  const timestamp = Date.now().toString(36); // Base36 for compactness
  const random = randomBytes(6).toString("hex"); // 12 hex chars
  return `TXN_${timestamp}_${random}`;
}

/**
 * Builds a UPI intent URL from merchant config and payment options.
 *
 * All parameters are URL-encoded to handle special characters in
 * merchant names or transaction notes safely.
 *
 * Returns the raw URL string — QR code generation is handled separately
 * to keep concerns clean (URL building vs image rendering).
 */
export function buildUpiIntentUrl(
  merchant: MerchantConfig,
  options: CreatePaymentOptions,
): string {
  const transactionId = options.transactionId ?? generateTransactionId();

  // Build URL parameters
  // pa = payee address (merchant UPI ID)
  // pn = payee name (shown in customer's UPI app)
  // am = amount (2 decimal places, as required by UPI spec)
  // tn = transaction note
  // tr = transaction reference (your internal ID)
  // cu = currency (always INR for UPI)
  const params = new URLSearchParams();
  params.set("pa", merchant.upiId);
  params.set("pn", merchant.name);
  params.set("am", options.amount.toFixed(2));
  params.set("tr", transactionId);
  params.set("cu", "INR");

  if (options.note) {
    params.set("tn", options.note);
  }

  // UPI uses a custom URL scheme, not https://
  // URLSearchParams encodes spaces as '+', but UPI apps expect '%20'
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

/**
 * App-specific UPI deep link schemes.
 *
 * Generic `upi://pay` intents triggered from web browsers get flagged as spam
 * by PhonePe, Paytm, and other UPI apps. App-specific schemes bypass this
 * because they tell the OS to open that specific app directly, avoiding the
 * generic intent resolver that triggers spam filters.
 *
 * QR scanning still uses generic `upi://pay` (always trusted by apps).
 * These app-specific schemes are only for "Open in X" buttons on web.
 */
export const UPI_APP_SCHEMES: Record<string, { name: string; scheme: string; icon?: string; android?: string; ios?: string }> = {
  gpay: {
    name: "Google Pay",
    scheme: "tez://upi/pay",
    android: "com.google.android.apps.nbu.paisa.user",
    ios: "tez://",
  },
  phonepe: {
    name: "PhonePe",
    scheme: "phonepe://pay",
    android: "com.phonepe.app",
    ios: "phonepe://",
  },
  paytm: {
    name: "Paytm",
    scheme: "paytmmp://pay",
    android: "net.one97.paytm",
    ios: "paytmmp://",
  },
  bhim: {
    name: "BHIM",
    scheme: "bhim://pay",
    android: "in.org.npci.upiapp",
    ios: "bhim://",
  },
  amazonpay: {
    name: "Amazon Pay",
    scheme: "amazonpay://pay",
    android: "in.amazon.mShop.android.shopping",
  },
  cred: {
    name: "CRED",
    scheme: "cred://upi/pay",
    android: "com.dreamplug.androidapp",
  },
};

/**
 * Build an app-specific UPI intent URL.
 *
 * Instead of `upi://pay?pa=...`, returns `phonepe://pay?pa=...` (for PhonePe)
 * or `tez://upi/pay?pa=...` (for GPay), etc.
 *
 * Use the generic `upi://pay` for QR codes (always trusted).
 * Use app-specific URLs for "Open in X" buttons on web pages.
 */
export function buildAppSpecificIntentUrl(
  genericIntentUrl: string,
  appId: keyof typeof UPI_APP_SCHEMES,
): string {
  const app = UPI_APP_SCHEMES[appId];
  if (!app) return genericIntentUrl;
  const queryString = genericIntentUrl.replace("upi://pay?", "");
  return `${app.scheme}?${queryString}`;
}

/**
 * Returns all supported UPI app deep link URLs for a given generic intent.
 * Useful for rendering a list of "Pay with X" buttons.
 */
export function buildAllAppIntentUrls(
  genericIntentUrl: string,
): Array<{ id: string; name: string; url: string; android?: string; ios?: string }> {
  return Object.entries(UPI_APP_SCHEMES).map(([id, app]) => ({
    id,
    name: app.name,
    url: buildAppSpecificIntentUrl(genericIntentUrl, id),
    android: app.android,
    ios: app.ios,
  }));
}
