"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { encrypt } from "@upiagent/core";
import { z } from "zod/v4";

const VALID_LLM_PROVIDERS = ["gemini", "openai", "anthropic"] as const;
const VALID_SOURCES = ["gmail", "sms", "webhook"] as const;

const updateMerchantSchema = z.object({
  name: z
    .string()
    .min(2, "Business name must be at least 2 characters")
    .max(100, "Business name must be at most 100 characters")
    .trim(),
  upi_id: z
    .string()
    .min(1, "UPI ID is required")
    .regex(/^[\w.\-]+@[\w.\-]+$/, "Invalid UPI ID format (expected: name@bank)"),
  upi_account_holder: z
    .string()
    .max(100, "Account holder name must be at most 100 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  contact_email: z
    .string()
    .email("Invalid email format")
    .optional()
    .or(z.literal("")),
  contact_phone: z
    .string()
    .regex(/^\+?[1-9]\d{6,14}$/, "Invalid phone number format")
    .optional()
    .or(z.literal("")),
  website_url: z
    .string()
    .url("Invalid website URL")
    .optional()
    .or(z.literal("")),
  description: z
    .string()
    .max(500, "Description must be at most 500 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  llm_provider: z.enum(VALID_LLM_PROVIDERS).optional(),
  llm_model: z
    .string()
    .max(100, "Model name too long")
    .optional()
    .or(z.literal("")),
  llm_api_key: z
    .string()
    .max(256, "API key too long")
    .optional()
    .or(z.literal("")),
  webhook_url: z
    .string()
    .url("Invalid webhook URL")
    .refine(
      (val) => val.startsWith("https://"),
      "Webhook URL must use HTTPS"
    )
    .optional()
    .or(z.literal("")),
  enabled_sources: z
    .string()
    .optional()
    .or(z.literal("")),
});

export async function updateMerchant(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Not authenticated" };
  }

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (merchantError || !merchant) {
    return { error: "Merchant not found" };
  }

  const raw = {
    name: formData.get("name") as string,
    upi_id: formData.get("upi_id") as string,
    upi_account_holder: (formData.get("upi_account_holder") as string) || "",
    contact_email: (formData.get("contact_email") as string) || "",
    contact_phone: (formData.get("contact_phone") as string) || "",
    website_url: (formData.get("website_url") as string) || "",
    description: (formData.get("description") as string) || "",
    llm_provider: (formData.get("llm_provider") as string) || "gemini",
    llm_model: (formData.get("llm_model") as string) || "gemini-2.0-flash",
    llm_api_key: (formData.get("llm_api_key") as string) || "",
    webhook_url: (formData.get("webhook_url") as string) || "",
    enabled_sources: (formData.get("enabled_sources") as string) || "",
  };

  const result = updateMerchantSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join(", ");
    console.error("Settings validation failed:", message);
    return { error: message };
  }

  const data = result.data;

  const enabledSources = data.enabled_sources
    ? data.enabled_sources.split(",").filter(Boolean)
    : [];

  // Validate each source value after splitting
  for (const source of enabledSources) {
    if (!VALID_SOURCES.includes(source as (typeof VALID_SOURCES)[number])) {
      return { error: `Invalid source: ${source}` };
    }
  }

  // Only update llm_api_key if the user provided a new value
  // (empty string means "keep existing", not "clear it")
  const updatePayload: Record<string, unknown> = {
    name: data.name,
    display_name: data.name,
    upi_id: data.upi_id,
    upi_account_holder: data.upi_account_holder || null,
    contact_email: data.contact_email || null,
    contact_phone: data.contact_phone || null,
    website_url: data.website_url || null,
    description: data.description || null,
    llm_provider: data.llm_provider || "gemini",
    llm_model: data.llm_model || "gemini-2.0-flash",
    webhook_url: data.webhook_url || null,
    enabled_sources: enabledSources,
    updated_at: new Date().toISOString(),
  };

  if (data.llm_api_key) {
    const encKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
    if (encKey) {
      updatePayload.llm_api_key = encrypt(data.llm_api_key, encKey);
    } else {
      console.warn("[settings] WARNING: storing LLM API key without encryption — CREDENTIALS_ENCRYPTION_KEY not set");
      updatePayload.llm_api_key = data.llm_api_key;
    }
  }

  const { error } = await supabase
    .from("merchants")
    .update(updatePayload)
    .eq("id", merchant.id);

  if (error) {
    console.error("Failed to update merchant:", error);
    return { error: "Failed to update merchant" };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}
