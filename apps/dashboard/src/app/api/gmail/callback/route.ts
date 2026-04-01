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
  const state = searchParams.get("state");

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3002";
  if (process.env.NODE_ENV === "production" && !appUrl.startsWith("https://")) {
    return NextResponse.json(
      { error: "NEXT_PUBLIC_APP_URL must use HTTPS in production" },
      { status: 500 },
    );
  }

  // CSRF validation: compare state param with stored cookie
  const cookieHeader = request.headers.get("cookie") || "";
  const stateMatch = cookieHeader.match(/(?:^|;\s*)gmail_oauth_state=([^;]+)/);
  const cookieState = stateMatch ? stateMatch[1] : null;

  if (!state || !cookieState || state !== cookieState) {
    console.error("[gmail/callback] CSRF state mismatch — possible forgery attempt");
    const resp = NextResponse.redirect(
      `${appUrl}/dashboard/settings?gmail=error&message=invalid_state`,
    );
    resp.cookies.delete("gmail_oauth_state");
    return resp;
  }

  // State validated — clear the one-time-use cookie
  const clearStateCookie = (resp: NextResponse) => {
    resp.cookies.delete("gmail_oauth_state");
    return resp;
  };

  if (error) {
    return clearStateCookie(
      NextResponse.redirect(
        `${appUrl}/dashboard/settings?gmail=error&message=${encodeURIComponent(error)}`,
      ),
    );
  }

  if (!code) {
    return clearStateCookie(
      NextResponse.redirect(
        `${appUrl}/dashboard/settings?gmail=error&message=no_code`,
      ),
    );
  }

  // Exchange code for tokens
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${appUrl}/api/gmail/callback`,
  );

  let tokens;
  try {
    const response = await oauth2Client.getToken(code);
    tokens = response.tokens;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "token_exchange_failed";
    return clearStateCookie(
      NextResponse.redirect(
        `${appUrl}/dashboard/settings?gmail=error&message=${encodeURIComponent(msg)}`,
      ),
    );
  }

  if (!tokens.refresh_token) {
    return clearStateCookie(
      NextResponse.redirect(
        `${appUrl}/dashboard/settings?gmail=error&message=no_refresh_token`,
      ),
    );
  }

  // Get current user from Supabase auth
  const supabaseAuth = await createServerClient();
  const { data: { user } } = await supabaseAuth.auth.getUser();

  if (!user) {
    return clearStateCookie(
      NextResponse.redirect(`${appUrl}/login`),
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

  // Encryption is mandatory — refuse to store plaintext credentials
  const encryptionKey = process.env.CREDENTIALS_ENCRYPTION_KEY;
  if (!encryptionKey) {
    console.error("[gmail/callback] CREDENTIALS_ENCRYPTION_KEY is not set — refusing to store plaintext credentials");
    return clearStateCookie(
      NextResponse.redirect(
        `${appUrl}/dashboard/settings?gmail=error&message=${encodeURIComponent("encryption_key_not_configured")}`,
      ),
    );
  }

  // Save to merchant record using service role (bypasses RLS)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Always encrypt before storing — fail hard if secrets are missing
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!googleClientSecret) {
    console.error("[gmail/callback] GOOGLE_CLIENT_SECRET is not set");
    return clearStateCookie(
      NextResponse.redirect(
        `${appUrl}/dashboard/settings?gmail=error&message=${encodeURIComponent("server_misconfigured")}`,
      ),
    );
  }

  const refreshToken = encrypt(tokens.refresh_token, encryptionKey);
  const clientSecret = encrypt(googleClientSecret, encryptionKey);

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
    console.error("[gmail/callback] Failed to update merchant:", updateError.message);
    return clearStateCookie(
      NextResponse.redirect(
        `${appUrl}/dashboard/settings?gmail=error&message=${encodeURIComponent("failed_to_save_credentials")}`,
      ),
    );
  }

  const emailParam = gmailEmail ? `&email=${encodeURIComponent(gmailEmail)}` : "";
  return clearStateCookie(
    NextResponse.redirect(
      `${appUrl}/dashboard/settings?gmail=connected${emailParam}`,
    ),
  );
}
