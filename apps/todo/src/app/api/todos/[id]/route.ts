import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();

  const updates: string[] = [];
  const args: unknown[] = [];

  if (body.status !== undefined) {
    updates.push("status = ?");
    args.push(body.status);
  }
  if (body.subtasks !== undefined) {
    updates.push("subtasks = ?");
    args.push(JSON.stringify(body.subtasks));
  }
  if (body.expanded_at !== undefined) {
    updates.push("expanded_at = ?");
    args.push(body.expanded_at);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  args.push(id);
  await db.execute({ sql: `UPDATE todos SET ${updates.join(", ")} WHERE id = ?`, args });

  const row = await db.execute({ sql: "SELECT * FROM todos WHERE id = ?", args: [id] });
  if (row.rows.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(row.rows[0]);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await db.execute({ sql: "DELETE FROM todos WHERE id = ?", args: [id] });
  return NextResponse.json({ ok: true });
}
