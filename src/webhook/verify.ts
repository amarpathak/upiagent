// packages/core/src/webhook/verify.ts
import { createHmac, timingSafeEqual } from "crypto";

export function signWebhookPayload(body: string, secretHex: string): string {
  const hmac = createHmac("sha256", Buffer.from(secretHex, "hex"));
  hmac.update(body, "utf8");
  return `sha256=${hmac.digest("hex")}`;
}

export function verifyWebhookSignature(
  body: string,
  signature: string,
  secretHex: string,
): boolean {
  if (!signature || !signature.startsWith("sha256=")) {
    return false;
  }
  const expected = signWebhookPayload(body, secretHex);
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}
