import { NextResponse } from "next/server";
import { google } from "googleapis";

/**
 * GET /api/gmail/connect
 *
 * Redirects user to Google's OAuth consent screen to grant
 * gmail.readonly access. After consent, Google redirects to
 * /api/gmail/callback with an auth code.
 */
export async function GET() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/api/gmail/callback`,
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });

  return NextResponse.redirect(authUrl);
}
