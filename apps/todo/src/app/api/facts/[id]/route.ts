import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.execute({ sql: "DELETE FROM user_facts WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
