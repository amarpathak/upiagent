import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ulid } from "@/lib/ulid";

export async function GET() {
  const result = await db.execute("SELECT * FROM user_facts ORDER BY created_at ASC");
  return NextResponse.json(result.rows);
}

export async function POST(req: NextRequest) {
  const { key, value } = await req.json();

  if (!key?.trim() || !value?.trim()) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }

  const id = ulid();
  const now = Date.now();

  await db.execute({
    sql: "INSERT INTO user_facts (id, key, value, created_at) VALUES (?, ?, ?, ?)",
    args: [id, key.trim(), value.trim(), now],
  });

  const row = await db.execute({ sql: "SELECT * FROM user_facts WHERE id = ?", args: [id] });
  return NextResponse.json(row.rows[0], { status: 201 });
}
