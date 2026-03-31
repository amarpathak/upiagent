"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import QRCode from "qrcode";

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

  const rawAmount = parseFloat(formData.get("amount") as string);
  if (isNaN(rawAmount) || rawAmount <= 0) {
    throw new Error("Invalid amount");
  }

  const note = (formData.get("note") as string) || "";
  const addPaisa = formData.get("addPaisa") === "on";

  let finalAmount = rawAmount;
  if (addPaisa) {
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
    tn: note,
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
      note,
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
