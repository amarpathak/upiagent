"use server";

import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createApiKey(formData: FormData) {
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

  const name = formData.get("name") as string;
  if (!name) {
    return { error: "Name is required" };
  }

  const rawKey = `upi_ak_${randomBytes(32).toString("hex")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.substring(0, 14);

  const { error } = await supabase.from("api_keys").insert({
    merchant_id: merchant.id,
    key_hash: keyHash,
    key_prefix: keyPrefix,
    name,
  });

  if (error) {
    console.error("Failed to create API key:", error);
    return { error: "Failed to create API key" };
  }

  revalidatePath("/dashboard/api-keys");
  return { success: true, key: rawKey };
}

export async function deleteApiKey(formData: FormData) {
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

  const keyId = formData.get("key_id") as string;
  if (!keyId) {
    return { error: "Key ID is required" };
  }

  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", keyId)
    .eq("merchant_id", merchant.id);

  if (error) {
    console.error("Failed to delete API key:", error);
    return { error: "Failed to delete API key" };
  }

  revalidatePath("/dashboard/api-keys");
  return { success: true };
}
