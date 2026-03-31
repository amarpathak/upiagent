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
    console.error("Failed to get user:", userError);
    return { error: "Not authenticated" };
  }

  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (merchantError || !merchant) {
    console.error("Failed to get merchant:", merchantError);
    return { error: "Merchant not found" };
  }

  const enabledSourcesRaw = formData.get("enabled_sources") as string;
  const enabledSources = enabledSourcesRaw
    ? enabledSourcesRaw.split(",").filter(Boolean)
    : [];

  const { error } = await supabase
    .from("merchants")
    .update({
      name: formData.get("name") as string,
      upi_id: formData.get("upi_id") as string,
      gmail_client_id: formData.get("gmail_client_id") as string,
      gmail_client_secret: formData.get("gmail_client_secret") as string,
      gmail_refresh_token: formData.get("gmail_refresh_token") as string,
      llm_provider: formData.get("llm_provider") as string,
      llm_api_key: formData.get("llm_api_key") as string,
      webhook_url: formData.get("webhook_url") as string,
      enabled_sources: enabledSources,
    })
    .eq("id", merchant.id);

  if (error) {
    console.error("Failed to update merchant:", error);
    return { error: "Failed to update merchant" };
  }

  revalidatePath("/dashboard/settings");
  return { success: true };
}
