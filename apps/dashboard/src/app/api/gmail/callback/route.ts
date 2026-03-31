import { NextResponse } from "next/server";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { encrypt } from "@upiagent/core";

/**
 * GET /api/gmail/callback?code=xxx
 *
 * Google redirects here after user grants gmail.readonly access.
 * We exchange the code for tokens, save the refresh token to the
 * merchant record, and redirect back to settings.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/dashboard/settings?gmail=error&message=${encodeURIComponent(error)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/dashboard/settings?gmail=error&message=no_code`,
    );
  }

  // Exchange code for tokens
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/api/gmail/callback`,
  );

  let tokens;
  try {
    const response = await oauth2Client.getToken(code);
    tokens = response.tokens;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "token_exchange_failed";
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/dashboard/settings?gmail=error&message=${encodeURIComponent(msg)}`,
    );
  }

  if (!tokens.refresh_token) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/dashboard/settings?gmail=error&message=no_refresh_token`,
    );
  }

  // Get current user from Supabase auth
  const supabaseAuth = await createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/login`,
    );
  }

  // Fetch the connected Gmail address
  oauth2Client.setCredentials(tokens);
  let gmailEmail = "";
  try {
    const gmailApi = google.gmail({ version: "v1", auth: oauth2Client });
    const profile = await gmailApi.users.getProfile({ userId: "me" });
    gmailEmail = profile.data.emailAddress || "";
  } catch {
    // Non-critical — we'll just not show the email
  }

  // Save to merchant record using service role (bypasses RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Encrypt sensitive credentials before storing
  const encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  const refreshToken = encryptionKey
    ? encrypt(tokens.refresh_token, encryptionKey)
    : tokens.refresh_token;
  const clientSecret = encryptionKey && process.env.GOOGLE_CLIENT_SECRET
    ? encrypt(process.env.GOOGLE_CLIENT_SECRET, encryptionKey)
    : process.env.GOOGLE_CLIENT_SECRET;

  const { error: updateError } = await supabaseAdmin
    .from("merchants")
    .update({
      gmail_client_id: process.env.GOOGLE_CLIENT_ID,
      gmail_client_secret: clientSecret,
      gmail_refresh_token: refreshToken,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/dashboard/settings?gmail=error&message=${encodeURIComponent(updateError.message)}`,
    );
  }

  const emailParam = gmailEmail ? `&email=${encodeURIComponent(gmailEmail)}` : "";
  return NextResponse.redirect(
    `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002"}/dashboard/settings?gmail=connected${emailParam}`,
  );
}
