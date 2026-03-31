import QRCode from "qrcode";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { amount, upiId, merchantName, note, addPaisa } = await req.json();

  if (!amount || amount < 1 || amount > 100000) {
    return NextResponse.json({ error: "Amount must be between 1 and 100000" }, { status: 400 });
  }

  // Add random paisa for unique amount matching
  let finalAmount = Number(amount);
  if (addPaisa) {
    const paisa = Math.floor(Math.random() * 99 + 1) / 100;
    finalAmount = Math.floor(finalAmount) + paisa;
  }

  const txnId = `TXN_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;

  const params = new URLSearchParams();
  params.set("pa", upiId || "amarpathakhdfc@ybl");
  params.set("pn", merchantName || "upiagent demo");
  params.set("am", finalAmount.toFixed(2));
  params.set("tr", txnId);
  params.set("cu", "INR");
  if (note) params.set("tn", note);

  const intentUrl = `upi://pay?${params.toString().replace(/\+/g, "%20")}`;

  const qrDataUrl = await QRCode.toDataURL(intentUrl, {
    width: 280,
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#fafafa", light: "#18181b" },
  });

  return NextResponse.json({
    qrDataUrl,
    intentUrl,
    amount: finalAmount,
    transactionId: txnId,
  });
}
