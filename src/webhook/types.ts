export type WebhookEvent = "payment.verified" | "payment.expired";

export interface WebhookPayload {
  event: WebhookEvent;
  timestamp: string;
  deliveryId: string;
  data: {
    paymentId: string;
    amount: number;
    currency: "INR";
    status: "verified" | "expired";
    upiReferenceId?: string;
    senderName?: string;
    confidence?: number;
    verifiedAt?: string;
  };
}

export interface WebhookDeliveryResult {
  delivered: boolean;
  attempts: number;
  responseStatus?: number;
  error?: string;
}

export interface WebhookConfig {
  url: string;
  secret: string;
}
