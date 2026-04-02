import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ulid } from "@/lib/ulid";

export async function GET() {
  const result = await db.execute("SELECT * FROM todos ORDER BY created_at DESC");
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const { text } = await req.json();

  if (!text?.trim()) {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  const id = ulid();
  const now = Date.now();

  await db.execute({
    sql: "INSERT INTO todos (id, text, status, subtasks, created_at) VALUES (?, ?, 'open', '[]', ?)",
    args: [id, text.trim(), now],
  });

  const row = await db.execute({ sql: "SELECT * FROM todos WHERE id = ?", args: [id] });
  return NextResponse.json(row.rows[0], { status: 201 });
}
