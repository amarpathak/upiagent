/**
 * Public API contracts — the single definition of every shape that crosses a
 * process boundary: REST requests/responses, webhook payloads, and (next) MCP
 * tool inputs/outputs.
 *
 * Each schema is used three ways:
 *   - the API routes parse request bodies with it and type their responses
 *     with `satisfies`, so a response that drifts from the contract fails tsc;
 *   - the client SDK parses responses with it, so consumers get runtime-checked
 *     data rather than an `as T` cast;
 *   - TypeScript types are inferred from it, never written by hand.
 *
 * Kept free of LangChain/Gmail imports so it can be imported on its own via
 * `upiagent/contracts` (e.g. by an MCP server or a browser bundle).
 */
import { z } from "zod/v4";

// ── Shared ──────────────────────────────────────────────────────

/**
 * Two-tier lifecycle:
 *   pending ──screenshot──> claimed ──bank evidence──> verified
 * `claimed` is an optimistic receipt (screenshot passed UTR-uniqueness, amount
 * and time checks); `verified` is corroborated by bank evidence. Release
 * low-ticket goods on `claimed`, high-ticket only on `verified`.
 */
export const paymentStatusSchema = z.enum(["pending", "claimed", "verified", "expired", "cancelled"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/** Every non-2xx API response. */
export const apiErrorSchema = z.object({ error: z.string() });
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const MIN_PAYMENT_AMOUNT = 1;
export const MAX_PAYMENT_AMOUNT = 100_000;

// ── POST /api/v1/payments ───────────────────────────────────────

export const createPaymentRequestSchema = z.object({
  amount: z
    .number()
    .min(MIN_PAYMENT_AMOUNT, `amount must be between ${MIN_PAYMENT_AMOUNT} and ${MAX_PAYMENT_AMOUNT}`)
    .max(MAX_PAYMENT_AMOUNT, `amount must be between ${MIN_PAYMENT_AMOUNT} and ${MAX_PAYMENT_AMOUNT}`),
  note: z.string().max(500).optional(),
  /** Add random paise (₹499 → ₹499.37) so concurrent payments are distinguishable. */
  addPaisa: z.boolean().optional(),
});
export type CreatePaymentRequest = z.infer<typeof createPaymentRequestSchema>;

export const createPaymentResponseSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  /** Amount the customer must pay, including any added paise. */
  amount: z.number(),
  intentUrl: z.string(),
  qrDataUrl: z.string(),
  status: z.literal("pending"),
  expiresAt: z.string(),
  createdAt: z.string(),
});
export type CreatePaymentResponse = z.infer<typeof createPaymentResponseSchema>;

// ── GET /api/v1/payments/:id ────────────────────────────────────

export const paymentSchema = z.object({
  id: z.string(),
  transactionId: z.string(),
  amount: z.number(),
  note: z.string().nullish(),
  status: paymentStatusSchema,
  intentUrl: z.string().nullish(),
  qrDataUrl: z.string().nullish(),
  expiresAt: z.string().nullish(),
  createdAt: z.string(),
  // Present once claimed or verified.
  upiReferenceId: z.string().nullish(),
  senderName: z.string().nullish(),
  senderUpiId: z.string().nullish(),
  bankName: z.string().nullish(),
  confidence: z.number().nullish(),
  claimedAt: z.string().nullish(),
  verifiedAt: z.string().nullish(),
});
export type Payment = z.infer<typeof paymentSchema>;

export const paymentEvidenceSchema = z.object({
  /** gmail | notification | screenshot */
  source: z.string(),
  /** match | no_match | error */
  status: z.string(),
  confidence: z.number().nullable(),
  createdAt: z.string(),
});
export type PaymentEvidence = z.infer<typeof paymentEvidenceSchema>;

export const paymentEvidenceListSchema = z.object({ evidence: z.array(paymentEvidenceSchema) });

/** GET /api/v1/payments query string. */
export const listPaymentsQuerySchema = z.object({
  status: paymentStatusSchema.optional(),
  /** ISO 8601; only payments created at or after it. */
  since: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().max(200).optional(),
});
export type ListPaymentsQuery = z.input<typeof listPaymentsQuerySchema>;

export const listPaymentsResponseSchema = z.object({
  payments: z.array(paymentSchema),
  hasMore: z.boolean(),
  /** Pass back as `cursor` for the next page; null on the last page. */
  nextCursor: z.string().nullable(),
});
export type ListPaymentsResponse = z.infer<typeof listPaymentsResponseSchema>;

export const usageSchema = z.object({
  tokensToday: z.number(),
  dailyLimit: z.number(),
  remaining: z.number(),
  /** "own_key" when the merchant's own LLM key pays for calls. */
  tier: z.enum(["platform", "own_key"]),
  /** ISO time the daily counter resets (00:00 UTC). */
  resetsAt: z.string(),
});
export type Usage = z.infer<typeof usageSchema>;

// ── POST /api/v1/payments/:id (trigger verification) ────────────

export const verifyPaymentResponseSchema = z.object({
  verified: z.boolean(),
  status: paymentStatusSchema,
  message: z.string().optional(),
  payment: z
    .object({
      amount: z.number(),
      upiReferenceId: z.string(),
      senderName: z.string(),
      bankName: z.string(),
      confidence: z.number(),
    })
    .optional(),
});
export type VerifyPaymentResponse = z.infer<typeof verifyPaymentResponseSchema>;

// ── POST /api/v1/payments/:id/proof (screenshot → claimed) ──────

export const submitProofRequestSchema = z.object({
  /** Base64 image, or a data: URL (image/png, image/jpeg, image/webp; max 3 MB decoded). */
  image: z.string().min(100).max(4_300_000),
  /** Required when `image` is bare base64. */
  mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional(),
});
export type SubmitProofRequest = z.infer<typeof submitProofRequestSchema>;

export const submitProofResponseSchema = z.object({
  /** False means: do NOT deliver the goods on the strength of this proof. */
  accepted: z.boolean(),
  /** Payment status after this call. */
  status: paymentStatusSchema,
  utr: z.string().nullable(),
  confidence: z.number(),
  /** Each check's outcome, in order. */
  reasons: z.array(z.string()),
});
export type SubmitProofResponse = z.infer<typeof submitProofResponseSchema>;

// ── POST /api/v1/notify (Android app evidence) ──────────────────

export const notificationDataSchema = z.object({
  /** Android package name of the source app (e.g. com.phonepe.app), or "sms:<sender>". */
  packageName: z.string().min(1).max(200),
  title: z.string().max(1000),
  body: z.string().max(5000),
  /** ISO string or epoch milliseconds. */
  receivedAt: z.union([z.string(), z.number()]),
});

export const MAX_NOTIFICATIONS_PER_REQUEST = 20;

export const notifyRequestSchema = z
  .object({
    notifications: z.array(notificationDataSchema).max(MAX_NOTIFICATIONS_PER_REQUEST, `Max ${MAX_NOTIFICATIONS_PER_REQUEST} notifications per request`).optional(),
    /** Single-notification form, kept for older app builds. */
    notification: notificationDataSchema.optional(),
    deviceId: z.string().max(200).optional(),
  })
  .transform(({ notifications, notification, deviceId }) => ({
    notifications: notifications ?? (notification ? [notification] : []),
    deviceId,
  }))
  .refine((r) => r.notifications.length > 0, { message: "No notifications provided" });
export type NotifyRequest = z.input<typeof notifyRequestSchema>;

// ── Webhooks ────────────────────────────────────────────────────

export const webhookEventSchema = z.enum(["payment.claimed", "payment.verified", "payment.expired"]);
export type WebhookEvent = z.infer<typeof webhookEventSchema>;

export const webhookPayloadSchema = z.object({
  event: webhookEventSchema,
  timestamp: z.string(),
  deliveryId: z.string(),
  data: z.object({
    paymentId: z.string(),
    amount: z.number(),
    currency: z.literal("INR"),
    status: z.enum(["claimed", "verified", "expired"]),
    upiReferenceId: z.string().optional(),
    senderName: z.string().optional(),
    confidence: z.number().optional(),
    verifiedAt: z.string().optional(),
  }),
});
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

// ── Helpers ─────────────────────────────────────────────────────

/** First issue as a single human-readable line, for `{ error }` responses. */
export function formatContractError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid request";
  const path = issue.path.join(".");
  return path ? `${path}: ${issue.message}` : issue.message;
}
