import { NextRequest, NextResponse } from "next/server";
import { signSession } from "@/lib/auth";
import { initDb } from "@/lib/db";

export async function POST(req: NextRequest) {
  const { password } = await req.json();

  if (password !== process.env.TODO_PASSWORD) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  await initDb();

  const token = await signSession();
  const res = NextResponse.json({ ok: true });
  res.cookies.set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  return res;
}
