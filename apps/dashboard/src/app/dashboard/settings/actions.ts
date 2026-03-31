"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const enabledSourcesRaw = formData.get("enabled_sources") as string;
  const enabledSources = enabledSourcesRaw
    ? enabledSourcesRaw.split(",").filter(Boolean)
    : [];

  const name = formData.get("name") as string;

  const { error } = await supabase
    .from("merchants")
    .update({
      name,
      display_name: name,
      upi_id: formData.get("upi_id") as string,
      upi_account_holder: (formData.get("upi_account_holder") as string) || null,
      contact_email: (formData.get("contact_email") as string) || null,
      contact_phone: (formData.get("contact_phone") as string) || null,
      website_url: (formData.get("website_url") as string) || null,
      description: (formData.get("description") as string) || null,
      llm_provider: (formData.get("llm_provider") as string) || "gemini",
      llm_api_key: (formData.get("llm_api_key") as string) || null,
      webhook_url: (formData.get("webhook_url") as string) || null,
      enabled_sources: enabledSources,
      updated_at: new Date().toISOString(),
    })
    .eq("id", merchant.id);

  if (error) {
    console.error("Failed to update merchant:", error);
    return { error: "Failed to update merchant" };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}
