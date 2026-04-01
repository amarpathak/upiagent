import { NextResponse } from "next/server";
import { google } from "googleapis";
import { randomBytes } from "crypto";
import { createClient as createAuthClient } from "@/lib/supabase/server";

/**
 * GET /api/gmail/connect
 *
 * Redirects user to Google's OAuth consent screen to grant
 * gmail.readonly access. After consent, Google redirects to
 * /api/gmail/callback with an auth code.
 */
export async function GET() {
  const authClient = await createAuthClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Authentication required" }, { status: 401 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
  if (process.env.NODE_ENV === "production" && !appUrl.startsWith("https://")) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL must use HTTPS in production" },
      { status: 500 },
    );
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/gmail/callback`,
  );

  const state = randomBytes(32).toString("hex");

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    state,
  });

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("gmail_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 600,
  });

  return response;
}
