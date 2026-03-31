"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function createMerchant(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  const upiId = formData.get("upi_id") as string;
  const upiAccountHolder = (formData.get("upi_account_holder") as string) || null;
  const contactEmail = (formData.get("contact_email") as string) || null;

  const { error } = await supabase.from("merchants").insert({
    user_id: user.id,
    name,
    display_name: name,
    upi_id: upiId,
    upi_account_holder: upiAccountHolder,
    contact_email: contactEmail,
  });

  if (error) {
    console.error("Failed to create merchant:", error);
    throw new Error("Failed to create merchant");
  }

  redirect("/dashboard");
}
