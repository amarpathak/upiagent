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
