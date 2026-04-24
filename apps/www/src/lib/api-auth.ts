// apps/www/src/lib/api-auth.ts
import { createHash } from "crypto";
import { getSupabase } from "./supabase";

export type AuthenticatedMerchant = {
  id: string;
  upi_id: string;
  name: string;
  display_name: string | null;
  gmail_client_id: string | null;
  gmail_client_secret: string | null;
  gmail_refresh_token: string | null;
  llm_provider: string | null;
  llm_model: string | null;
  llm_api_key: string | null;
  webhook_url: string | null;
  webhook_secret: string | null;
};

export type AuthResult =
  | { ok: true; merchant: AuthenticatedMerchant; apiKeyId: string }
  | { ok: false; status: number; error: string };

export async function authenticateApiKey(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { ok: false, status: 401, error: "Missing or invalid Authorization header. Use: Bearer <api_key>" };
  }

  const rawKey = authHeader.slice(7);
  if (!rawKey || rawKey.length < 20) {
    return { ok: false, status: 401, error: "Invalid API key format" };
  }

  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const supabase = getSupabase();

  const { data: apiKey, error: keyError } = await supabase
    .from("api_keys")
    .select("id, merchant_id")
    .eq("key_hash", keyHash)
    .single();

  if (keyError || !apiKey) {
    return { ok: false, status: 401, error: "Invalid API key" };
  }

  // Update last_used_at (fire-and-forget)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", apiKey.id)
    .then(() => {});

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id, upi_id, name, display_name, gmail_client_id, gmail_client_secret, gmail_refresh_token, llm_provider, llm_model, llm_api_key, webhook_url, webhook_secret")
    .eq("id", apiKey.merchant_id)
    .single();

  if (merchantError || !merchant) {
    return { ok: false, status: 401, error: "Merchant not found for this API key" };
  }

  return { ok: true, merchant, apiKeyId: apiKey.id };
}
