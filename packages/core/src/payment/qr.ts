/**
 * QR Code Generator
 *
 * Converts UPI intent URLs into QR code images that customers can scan.
 *
 * We use the `qrcode` library which generates QR codes as:
 * - Data URLs (base64 PNG) — embed directly in HTML: <img src={dataUrl} />
 * - SVG strings — for server-side rendering or vector output
 * - Terminal output — for CLI tools
 *
 * The QR code IS the payment interface. Unlike traditional PGs where you
 * redirect to a payment page, UPI payments happen entirely through the
 * QR scan → UPI app flow. The merchant (your app) never touches the
 * customer's banking credentials.
 */

import QRCode from "qrcode";
import type { MerchantConfig, CreatePaymentOptions, PaymentRequest } from "./types.js";
import { buildUpiIntentUrl, generateTransactionId } from "./intent.js";

/**
 * Creates a complete PaymentRequest with QR code.
 *
 * This is the main function consumers use to create a payment.
 * It generates the UPI intent URL, renders it as a QR code,
 * and returns everything needed to display the payment screen.
 *
 * Usage in a Next.js API route:
 *   const payment = await createPayment(merchant, { amount: 499 });
 *   return Response.json(payment);
 *
 * Usage in frontend:
 *   <img src={payment.qrDataUrl} alt="Scan to pay" />
 */
export async function createPayment(
  merchant: MerchantConfig,
  options: CreatePaymentOptions,
): Promise<PaymentRequest> {
  const transactionId = options.transactionId ?? generateTransactionId();

  // If addPaisa is enabled, append random paisa for unique amount matching.
  // This turns ₹499 into ₹499.37, making each payment uniquely verifiable.
  let finalAmount = options.amount;
  if (options.addPaisa) {
    const paisa = Math.floor(Math.random() * 99 + 1) / 100; // 0.01 to 0.99
    finalAmount = Math.floor(options.amount) + paisa;
  }

  // Build the UPI intent URL with the finalized transaction ID
  const intentUrl = buildUpiIntentUrl(merchant, {
    ...options,
    amount: finalAmount,
    transactionId,
  });

  // Generate QR code as a base64 data URL (PNG format).
  // This can be used directly as an <img> src attribute.
  //
  // Options explained:
  // - width: 300px is a good default for mobile scanning
  // - margin: 2 modules of white space around the QR (helps scanners)
  // - errorCorrectionLevel: 'M' (medium, ~15% recovery) — balances
  //   scannability with data density. 'H' (high) makes the QR bigger.
  const qrDataUrl = await QRCode.toDataURL(intentUrl, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
    color: {
      dark: "#000000",
      light: "#FFFFFF",
    },
  });

  return {
    transactionId,
    intentUrl,
    qrDataUrl,
    amount: finalAmount,
    createdAt: new Date(),
    merchantUpiId: merchant.upiId,
  };
}

/**
 * Generates just the QR code as an SVG string.
 *
 * Useful for server-side rendering or when you want vector output
 * (SVGs scale perfectly at any size, unlike PNGs).
 */
export async function createPaymentSvg(
  merchant: MerchantConfig,
  options: CreatePaymentOptions,
): Promise<{ svg: string; intentUrl: string; transactionId: string }> {
  const transactionId = options.transactionId ?? generateTransactionId();

  const intentUrl = buildUpiIntentUrl(merchant, {
    ...options,
    transactionId,
  });

  const svg = await QRCode.toString(intentUrl, {
    type: "svg",
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  return { svg, intentUrl, transactionId };
}
