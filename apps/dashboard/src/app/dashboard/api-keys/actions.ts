"use server";

import { randomBytes, createHash } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

const createApiKeySchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(64, "Name must be at most 64 characters")
    .trim(),
});

const deleteApiKeySchema = z.object({
  key_id: z
    .string()
    .uuid("Invalid key ID format"),
});

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

  const result = createApiKeySchema.safeParse({
    name: formData.get("name") as string,
  });
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join(", ");
    console.error("API key creation validation failed:", message);
    return { error: message };
  }

  const { name } = result.data;

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

  const result = deleteApiKeySchema.safeParse({
    key_id: formData.get("key_id") as string,
  });
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join(", ");
    console.error("API key deletion validation failed:", message);
    return { error: message };
  }

  const { key_id } = result.data;

  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", key_id)
    .eq("merchant_id", merchant.id);

  if (error) {
    console.error("Failed to delete API key:", error);
    return { error: "Failed to delete API key" };
  }

  revalidatePath("/dashboard/api-keys");
  return { success: true };
}
