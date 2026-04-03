/**
 * Payment Module Types
 *
 * These types define the payment creation flow — generating UPI intent
 * URLs and QR codes that customers scan to pay.
 */

/**
 * Merchant/payee configuration — who receives the payment.
 *
 * This is set once per merchant and passed to createPayment()
 * for all payment QR codes.
 */
export interface MerchantConfig {
  /** Merchant UPI ID (e.g., "shop@ybl", "business@paytm") */
  upiId: string;

  /** Display name shown in UPI app when customer scans */
  name: string;
}

/**
 * Options for creating a new payment request (QR code).
 */
export interface CreatePaymentOptions {
  /** Amount in INR to collect */
  amount: number;

  /**
   * Add random paisa (0.01–0.99) to the amount for unique verification.
   *
   * When enabled, a ₹499 payment becomes ₹499.37 (random). This makes
   * each QR amount unique, so verification can match EXACTLY — even if
   * multiple customers pay similar amounts at the same time.
   *
   * The actual charged amount (with paisa) is returned in the PaymentRequest
   * so you know precisely what to verify against.
   *
   * Default: false
   */
  addPaisa?: boolean;

  /**
   * Your internal reference ID for this transaction.
   * This is passed in the UPI intent URL as `tr` (transaction reference).
   * You'll use this to correlate the payment with your order/invoice.
   *
   * If not provided, we generate a random one.
   */
  transactionId?: string;

  /** Note/description shown in the customer's UPI app */
  note?: string;
}

/**
 * A created payment request — contains everything needed to display
 * a payment QR code and later verify the payment.
 */
export interface PaymentRequest {
  /** Your internal transaction reference ID */
  transactionId: string;

  /** The UPI intent URL (what the QR code encodes) */
  intentUrl: string;

  /** QR code as a base64-encoded PNG data URL — ready to use in an <img> tag */
  qrDataUrl: string;

  /** The amount being collected */
  amount: number;

  /** When this payment request was created */
  createdAt: Date;

  /** Merchant UPI ID receiving the payment */
  merchantUpiId: string;
}
