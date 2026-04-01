"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QRCode from "qrcode";
import { z } from "zod/v4";

const createPaymentSchema = z.object({
  amount: z
    .string()
    .min(1, "Amount is required")
    .refine(
      (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
      "Amount must be a positive number"
    )
    .refine(
      (val) => parseFloat(val) <= 100000,
      "Amount must be at most 1,00,000"
    ),
  note: z
    .string()
    .max(255, "Note must be at most 255 characters")
    .trim()
    .optional()
    .or(z.literal("")),
  addPaisa: z
    .string()
    .optional(),
});

export async function createPaymentAction(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Unauthorized");
  }

  const { data: merchant } = await supabase
    .from("merchants")
    .select("id, name, upi_id")
    .eq("user_id", user.id)
    .single();

  if (!merchant) {
    throw new Error("Merchant not found");
  }

  const result = createPaymentSchema.safeParse({
    amount: formData.get("amount") as string,
    note: (formData.get("note") as string) || "",
    addPaisa: (formData.get("addPaisa") as string) || undefined,
  });

  if (!result.success) {
    const message = result.error.issues.map((i) => i.message).join(", ");
    console.error("Payment creation validation failed:", message);
    throw new Error(message);
  }

  const { amount: amountStr, note, addPaisa } = result.data;
  const rawAmount = parseFloat(amountStr);

  let finalAmount = rawAmount;
  if (addPaisa === "on") {
    const paisa = Math.floor(Math.random() * 99 + 1) / 100;
    finalAmount = rawAmount + paisa;
  }

  const txnId = `TXN_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

  const params = new URLSearchParams({
    pa: merchant.upi_id,
    pn: merchant.name,
    am: finalAmount.toFixed(2),
    tr: txnId,
    cu: "INR",
    tn: note || "",
  });
  const intentUrl = `upi://pay?${params.toString()}`;

  const qrDataUrl = await QRCode.toDataURL(intentUrl, {
    width: 300,
    margin: 2,
    errorCorrectionLevel: "M",
  });

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const { data: payment, error } = await supabase
    .from("payments")
    .insert({
      merchant_id: merchant.id,
      transaction_id: txnId,
      amount: rawAmount,
      amount_with_paisa: finalAmount,
      note: note || "",
      intent_url: intentUrl,
      qr_data_url: qrDataUrl,
      status: "pending",
      expires_at: expiresAt,
    })
    .select("id")
    .single();

  if (error || !payment) {
    console.error("Failed to create payment:", error);
    throw new Error("Failed to create payment");
  }

  redirect(`/dashboard/payments/${payment.id}`);
}
