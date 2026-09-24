/**
 * upiagent's MCP tools — defined once here and served by both the hosted
 * endpoint and (later) the local stdio server, each supplying a backend.
 *
 * Tool descriptions are the only documentation an agent reads, so they state
 * the release rules plainly: `claimed` is screenshot-backed (fine for low
 * value), `verified` is bank-confirmed, and a rejected proof means do not
 * deliver.
 */
import { z } from "zod/v4";
import {
  MAX_PAYMENT_AMOUNT,
  MIN_PAYMENT_AMOUNT,
  paymentStatusSchema,
  paymentSchema,
  paymentEvidenceSchema,
  usageSchema,
  submitProofResponseSchema,
  type CreatePaymentResponse,
  type ListPaymentsResponse,
  type Payment,
  type PaymentEvidence,
  type PaymentStatus,
  type SubmitProofRequest,
  type SubmitProofResponse,
  type Usage,
} from "../contracts/index.js";
import { defineTool, type McpTool } from "./server.js";

/** What a transport must provide. Errors meant for the agent are ToolError. */
export interface UpiAgentBackend {
  createPayment(req: { amount: number; note?: string; addPaisa: boolean }): Promise<CreatePaymentResponse>;
  submitProof(paymentId: string, proof: SubmitProofRequest): Promise<SubmitProofResponse>;
  getPayment(paymentId: string): Promise<Payment>;
  getEvidence(paymentId: string): Promise<PaymentEvidence[]>;
  listPayments(opts: { status?: PaymentStatus; since?: string; limit: number; cursor?: string }): Promise<ListPaymentsResponse>;
  cancelPayment(paymentId: string): Promise<Payment>;
  getUsage(): Promise<Usage>;
}

const paymentId = z.string().uuid().describe("The paymentId returned by upiagent_create_payment.");

/** Payment as shown to agents: the QR image is omitted to save context. */
const agentPaymentSchema = paymentSchema.omit({ qrDataUrl: true });
function forAgent(p: Payment): z.input<typeof agentPaymentSchema> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { qrDataUrl, ...rest } = p;
  return rest;
}

const STATUS_GUIDE =
  "Statuses: pending (not paid yet) → claimed (customer's screenshot passed all checks; OK to release low-value goods) → verified (bank-confirmed; OK to release anything). expired/cancelled are final.";

export const createPaymentTool = defineTool({
  name: "upiagent_create_payment",
  title: "Create UPI payment request",
  description:
    "Create a UPI payment request for the merchant. Returns a upi:// intentUrl to show or send to the customer (any UPI app opens it) and the exact amount to pay — with addPaisa (default on) a few random paise are added so concurrent payments can be told apart; the customer must pay that exact amount. Requests expire after 20 minutes. Spends no LLM tokens.",
  inputSchema: z.object({
    amount: z.number().min(MIN_PAYMENT_AMOUNT).max(MAX_PAYMENT_AMOUNT).describe("Amount in rupees, e.g. 499."),
    note: z.string().max(80).optional().describe("Short note shown in the customer's UPI app, e.g. an order reference."),
    addPaisa: z.boolean().default(true).describe("Add random paise for unique matching. Leave on unless the amount must be exact."),
    includeQr: z.boolean().default(false).describe("Also return the QR code as a PNG data URL (large)."),
  }),
  outputSchema: z.object({
    paymentId: z.string(),
    transactionId: z.string(),
    amount: z.number().describe("Exact amount the customer must pay."),
    intentUrl: z.string(),
    qrDataUrl: z.string().optional(),
    status: z.literal("pending"),
    expiresAt: z.string(),
  }),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  handler: async ({ amount, note, addPaisa, includeQr }, backend: UpiAgentBackend) => {
    const p = await backend.createPayment({ amount, note, addPaisa });
    return {
      paymentId: p.id,
      transactionId: p.transactionId,
      amount: p.amount,
      intentUrl: p.intentUrl,
      ...(includeQr && { qrDataUrl: p.qrDataUrl }),
      status: p.status,
      expiresAt: p.expiresAt,
    };
  },
});

export const submitPaymentProofTool = defineTool({
  name: "upiagent_submit_payment_proof",
  title: "Submit payment screenshot",
  description:
    "Check the customer's UPI payment screenshot against a pending payment: success status, exact amount, paid to this merchant, paid after the request was created, and a UTR never used before. If accepted is true the payment becomes claimed and low-value goods may be released now. If accepted is false, do NOT deliver the goods — tell the customer the reasons and wait for bank confirmation or a correct screenshot. This is the only tool that spends LLM tokens (one vision call); check upiagent_get_usage if unsure of budget.",
  inputSchema: z.object({
    paymentId,
    image: z.string().min(100).max(4_300_000).describe("The screenshot as base64 or a data: URL (PNG, JPEG or WebP, max 3 MB)."),
    mediaType: z.enum(["image/png", "image/jpeg", "image/webp"]).optional().describe("Required when image is bare base64."),
  }),
  outputSchema: submitProofResponseSchema,
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ paymentId: id, image, mediaType }, backend: UpiAgentBackend) =>
    backend.submitProof(id, { image, mediaType }),
});

export const getPaymentStatusTool = defineTool({
  name: "upiagent_get_payment_status",
  title: "Get payment status",
  description: `Current status of a payment and its evidence trail (which sources — gmail, notification, screenshot — matched and with what confidence). A pure read: spends no LLM tokens, so it is fine to call repeatedly while waiting for a customer to pay. ${STATUS_GUIDE}`,
  inputSchema: z.object({ paymentId }),
  outputSchema: z.object({ payment: agentPaymentSchema, evidence: z.array(paymentEvidenceSchema) }),
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async ({ paymentId: id }, backend: UpiAgentBackend) => {
    const [payment, evidence] = await Promise.all([backend.getPayment(id), backend.getEvidence(id)]);
    return { payment: forAgent(payment), evidence };
  },
});

export const listPaymentsTool = defineTool({
  name: "upiagent_list_payments",
  title: "List payments",
  description: `List the merchant's payments, newest first, optionally filtered by status or creation time. Paginated: pass nextCursor back as cursor. Spends no LLM tokens. ${STATUS_GUIDE}`,
  inputSchema: z.object({
    status: paymentStatusSchema.optional().describe("Only payments in this status."),
    since: z.string().datetime({ offset: true }).optional().describe("ISO 8601 time; only payments created at or after it."),
    limit: z.number().int().min(1).max(50).default(20),
    cursor: z.string().optional().describe("nextCursor from the previous page."),
  }),
  outputSchema: z.object({
    payments: z.array(agentPaymentSchema),
    hasMore: z.boolean(),
    nextCursor: z.string().nullable(),
  }),
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (input, backend: UpiAgentBackend) => {
    const page = await backend.listPayments(input);
    return { ...page, payments: page.payments.map(forAgent) };
  },
});

export const cancelPaymentTool = defineTool({
  name: "upiagent_cancel_payment",
  title: "Cancel payment",
  description: "Cancel a pending payment request, e.g. when the customer abandons checkout. Only pending payments can be cancelled; claimed or verified ones cannot. Spends no LLM tokens.",
  inputSchema: z.object({ paymentId }),
  outputSchema: z.object({ payment: agentPaymentSchema }),
  annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  handler: async ({ paymentId: id }, backend: UpiAgentBackend) => ({ payment: forAgent(await backend.cancelPayment(id)) }),
});

export const getUsageTool = defineTool({
  name: "upiagent_get_usage",
  title: "Get LLM usage",
  description: "Today's LLM token usage against the merchant's daily limit. Only screenshot proofs spend tokens; when remaining is low, prefer waiting for bank confirmation (poll upiagent_get_payment_status) over submitting screenshots.",
  inputSchema: z.object({}),
  outputSchema: usageSchema,
  annotations: { readOnlyHint: true, openWorldHint: false },
  handler: async (_input, backend: UpiAgentBackend) => backend.getUsage(),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const UPIAGENT_TOOLS: McpTool<any, any, UpiAgentBackend>[] = [
  createPaymentTool,
  submitPaymentProofTool,
  getPaymentStatusTool,
  listPaymentsTool,
  cancelPaymentTool,
  getUsageTool,
];

export const UPIAGENT_MCP_INSTRUCTIONS = [
  "upiagent lets you take UPI payments in India with no payment gateway.",
  "Flow: upiagent_create_payment → give the customer the intentUrl and exact amount → either the customer sends a payment screenshot (upiagent_submit_payment_proof) or you poll upiagent_get_payment_status until bank evidence arrives.",
  STATUS_GUIDE,
  "Never deliver goods on a rejected proof.",
].join(" ");
