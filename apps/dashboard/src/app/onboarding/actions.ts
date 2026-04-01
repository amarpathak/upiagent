"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { z } from "zod/v4";

const createMerchantSchema = z.object({
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
});

export async function createMerchant(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const raw = {
    name: formData.get("name") as string,
    upi_id: formData.get("upi_id") as string,
    upi_account_holder: (formData.get("upi_account_holder") as string) || undefined,
    contact_email: (formData.get("contact_email") as string) || undefined,
  };

  const result = createMerchantSchema.safeParse(raw);
  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join(", ");
    console.error("Onboarding validation failed:", message);
    throw new Error(message);
  }

  const { name, upi_id, upi_account_holder, contact_email } = result.data;

  const { error } = await supabase.from("merchants").insert({
    user_id: user.id,
    name,
    display_name: name,
    upi_id,
    upi_account_holder: upi_account_holder || null,
    contact_email: contact_email || null,
  });

  if (error) {
    console.error("Failed to create merchant:", error);
    throw new Error("Failed to create merchant");
  }

  redirect("/dashboard");
}
