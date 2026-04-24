/**
 * UpiAgent Client SDK
 *
 * Thin wrapper around the UpiAgent SaaS API.
 * Like Stripe's SDK — handles auth, requests, and types.
 *
 * Usage:
 *   import { UpiAgent } from "upiagent/client";
 *
 *   const upi = new UpiAgent({ apiKey: "upi_ak_..." });
 *   const payment = await upi.createPayment({ amount: 499, addPaisa: true });
 *   const result = await upi.verify(payment.id);
 *   const status = await upi.getStatus(payment.id);
 */

export interface UpiAgentConfig {
  apiKey: string;
  baseUrl?: string;
}

export interface CreatePaymentParams {
  amount: number;
  note?: string;
  addPaisa?: boolean;
}

export interface Payment {
  id: string;
  transactionId: string;
  amount: number;
  intentUrl: string;
  qrDataUrl: string;
  status: "pending" | "verified" | "expired";
  expiresAt: string;
  createdAt: string;
  note?: string;
  upiReferenceId?: string;
  senderName?: string;
  senderUpiId?: string;
  bankName?: string;
  confidence?: number;
  verifiedAt?: string;
}

export interface VerifyResult {
  verified: boolean;
  status: string;
  message?: string;
  payment?: {
    amount: number;
    upiReferenceId: string;
    senderName: string;
    bankName: string;
    confidence: number;
  };
}

export class UpiAgentApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown,
  ) {
    super(message);
    this.name = "UpiAgentApiError";
  }
}

export class UpiAgent {
  private apiKey: string;
  private baseUrl: string;

  constructor(config: UpiAgentConfig) {
    if (!config.apiKey) throw new Error("apiKey is required");
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || "https://beta.upiagent.live").replace(/\/$/, "");
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new UpiAgentApiError(
        data.error || `API error: ${res.status}`,
        res.status,
        data,
      );
    }

    return data as T;
  }

  /**
   * Create a payment with QR code
   */
  async createPayment(params: CreatePaymentParams): Promise<Payment> {
    return this.request<Payment>("POST", "/api/v1/payments", params);
  }

  /**
   * Trigger active verification (scans Gmail for bank alert)
   * Call this after the customer has paid.
   */
  async verify(paymentId: string): Promise<VerifyResult> {
    return this.request<VerifyResult>("POST", `/api/v1/payments/${paymentId}`);
  }

  /**
   * Check payment status (read-only, no verification triggered)
   */
  async getStatus(paymentId: string): Promise<Payment> {
    return this.request<Payment>("GET", `/api/v1/payments/${paymentId}`);
  }

  /**
   * Wait for payment verification with polling.
   * Creates payment, then polls verify + getStatus until verified or timeout.
   *
   * @param params - Payment params
   * @param options - Polling options
   * @returns Payment object with final status
   */
  async createAndWaitForPayment(
    params: CreatePaymentParams,
    options?: {
      /** Called with payment after creation (show QR here) */
      onPaymentCreated?: (payment: Payment) => void;
      /** Called on each poll with current status */
      onStatusUpdate?: (status: Payment) => void;
      /** Polling interval in ms (default: 5000) */
      pollInterval?: number;
      /** Timeout in ms (default: 180000 = 3 min) */
      timeout?: number;
      /** Delay before first verify in ms (default: 10000) */
      initialDelay?: number;
    },
  ): Promise<Payment> {
    const {
      onPaymentCreated,
      onStatusUpdate,
      pollInterval = 5000,
      timeout = 180_000,
      initialDelay = 10_000,
    } = options || {};

    const payment = await this.createPayment(params);
    onPaymentCreated?.(payment);

    // Wait for customer to pay
    await new Promise((r) => setTimeout(r, initialDelay));

    const deadline = Date.now() + timeout;

    while (Date.now() < deadline) {
      // Trigger verification
      try {
        const result = await this.verify(payment.id);
        if (result.verified) {
          const final = await this.getStatus(payment.id);
          onStatusUpdate?.(final);
          return final;
        }
      } catch {
        // verify can fail transiently, keep polling
      }

      // Check status
      const status = await this.getStatus(payment.id);
      onStatusUpdate?.(status);

      if (status.status === "verified") return status;
      if (status.status === "expired") return status;

      await new Promise((r) => setTimeout(r, pollInterval));
    }

    // Timed out — return last status
    return this.getStatus(payment.id);
  }
}
