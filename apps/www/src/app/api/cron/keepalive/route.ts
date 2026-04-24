import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET(req: Request) {
  // Verify the request is from Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getSupabase();
  const { count, error } = await supabase
    .from("merchants")
    .select("id", { count: "exact", head: true });

  if (error) {
    console.error("[keepalive] Supabase ping failed:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  console.log(`[keepalive] Supabase alive, ${count} merchants`);
  return NextResponse.json({ ok: true, merchants: count });
}
