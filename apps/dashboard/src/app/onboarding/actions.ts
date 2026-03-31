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
    console.error("Failed to get user:", userError);
    redirect("/login");
  }

  const name = formData.get("name") as string;
  const upiId = formData.get("upi_id") as string;

  const { error } = await supabase.from("merchants").insert({
    user_id: user.id,
    name,
    upi_id: upiId,
  });

  if (error) {
    console.error("Failed to create merchant:", error);
    throw new Error("Failed to create merchant");
  }

  redirect("/dashboard");
}
