/**
 * Gmail OAuth Setup Flow
 *
 * This module automates the painful "go to Google Cloud Console, create
 * credentials, use the OAuth Playground" flow into a single function call.
 *
 * How it works:
 * 1. Consumer provides their Google Cloud OAuth client_id + client_secret
 *    (they still need to create these in Google Cloud Console — there's no
 *    way around that. But it's the ONLY manual step.)
 * 2. We open the browser to Google's consent screen
 * 3. User clicks "Allow" → Google redirects to our local callback server
 * 4. We exchange the auth code for a refresh token
 * 5. Return the refresh token (consumer saves it to .env or their secrets manager)
 *
 * Why can't we skip the Google Cloud Console step?
 * Because Google requires every app that accesses Gmail to have its own
 * OAuth client credentials. This is a security measure — it lets users
 * see which "app" is requesting access and revoke it later. There's no
 * shared/universal credential we could bundle.
 *
 * FDE insight: OAuth setup is the #1 friction point for any Google API
 * integration. Making it as smooth as possible directly impacts adoption.
 */

import { google } from "googleapis";
import http from "http";
import { URL } from "url";

/**
 * Result of the Gmail OAuth setup flow.
 */
export interface GmailAuthResult {
  /** The refresh token — store this securely, it doesn't expire */
  refreshToken: string;
  /** The access token — short-lived, you usually don't need to store this */
  accessToken: string;
  /** When the access token expires */
  expiryDate: number | null;
}

export interface GmailAuthSetupOptions {
  /** Google OAuth Client ID (from Google Cloud Console) */
  clientId: string;
  /** Google OAuth Client Secret (from Google Cloud Console) */
  clientSecret: string;
  /** Local port for the OAuth callback server (default: 3456) */
  callbackPort?: number;
  /**
   * Whether to automatically open the browser (default: true).
   * Set to false in headless environments — the URL will be printed instead.
   */
  openBrowser?: boolean;
}

/**
 * Runs the interactive Gmail OAuth setup flow.
 *
 * Opens a browser for the user to grant Gmail read-only access,
 * then exchanges the auth code for a refresh token.
 *
 * Usage:
 *   const result = await setupGmailAuth({
 *     clientId: "your-client-id",
 *     clientSecret: "your-client-secret",
 *   });
 *   console.log("Refresh token:", result.refreshToken);
 *   // Save result.refreshToken to .env or secrets manager
 */
export async function setupGmailAuth(
  options: GmailAuthSetupOptions,
): Promise<GmailAuthResult> {
  const { clientId, clientSecret, callbackPort = 3456 } = options;
  const openBrowser = options.openBrowser ?? true;

  const redirectUri = `http://localhost:${callbackPort}/callback`;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

  // Generate the consent URL.
  // access_type: "offline" is what gives us a refresh_token (long-lived).
  // prompt: "consent" forces the consent screen even if the user previously
  // authorized — this ensures we always get a refresh_token back.
  // (Without it, Google only sends refresh_token on first authorization.)
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });

  // Wait for the user to authorize and Google to redirect back
  const code = await waitForAuthCode(authUrl, callbackPort, openBrowser);

  // Exchange the auth code for tokens
  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "No refresh token received. This usually means the consent screen wasn't shown. " +
        "Try revoking access at https://myaccount.google.com/permissions and running setup again.",
    );
  }

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token ?? "",
    expiryDate: tokens.expiry_date ?? null,
  };
}

/**
 * Starts a temporary local HTTP server to catch the OAuth callback.
 *
 * This is the standard pattern for CLI OAuth flows:
 * 1. Start a local server on a known port
 * 2. Open the browser to Google's consent URL (redirect_uri points to our server)
 * 3. User authorizes → Google redirects to http://localhost:{port}/callback?code=XXX
 * 4. We grab the code and shut down the server
 *
 * The server only accepts one request and then shuts down. It's ephemeral.
 */
function waitForAuthCode(
  authUrl: string,
  port: number,
  openBrowser: boolean,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (!req.url?.startsWith("/callback")) {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const parsedUrl = new URL(req.url, `http://localhost:${port}`);
      const code = parsedUrl.searchParams.get("code");
      const error = parsedUrl.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(errorHtml(error));
        server.close();
        reject(new Error(`OAuth authorization denied: ${error}`));
        return;
      }

      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(errorHtml("No authorization code received"));
        server.close();
        reject(new Error("No authorization code in callback URL"));
        return;
      }

      // Success — show a nice page and return the code
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(successHtml());
      server.close();
      resolve(code);
    });

    server.listen(port, () => {
      if (openBrowser) {
        // Dynamic import to avoid bundling issues
        import("child_process").then(({ exec }) => {
          // Cross-platform browser open
          const cmd =
            process.platform === "darwin"
              ? "open"
              : process.platform === "win32"
                ? "start"
                : "xdg-open";
          exec(`${cmd} "${authUrl}"`);
        });
      }

      // Always print the URL — in case the browser doesn't open
      // eslint-disable-next-line no-console
      console.log("\n┌─────────────────────────────────────────────┐");
      // eslint-disable-next-line no-console
      console.log("│  upiagent — Gmail OAuth Setup               │");
      // eslint-disable-next-line no-console
      console.log("├─────────────────────────────────────────────┤");
      // eslint-disable-next-line no-console
      console.log("│  Open this URL in your browser:             │");
      // eslint-disable-next-line no-console
      console.log("│                                             │");
      // eslint-disable-next-line no-console
      console.log(`│  ${authUrl.substring(0, 43)}│`);
      // eslint-disable-next-line no-console
      console.log("│                                             │");
      // eslint-disable-next-line no-console
      console.log("│  Waiting for authorization...               │");
      // eslint-disable-next-line no-console
      console.log("└─────────────────────────────────────────────┘\n");
    });

    // Timeout after 5 minutes — user probably abandoned
    setTimeout(() => {
      server.close();
      reject(new Error("OAuth setup timed out after 5 minutes"));
    }, 5 * 60 * 1000);
  });
}

/** HTML shown in the browser after successful authorization */
function successHtml(): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>upiagent — Gmail authorized</title></head>
<body style="font-family: system-ui; background: #09090b; color: #fafafa; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
  <div style="text-align: center; max-width: 400px;">
    <div style="font-size: 48px; margin-bottom: 16px; color: #22c55e;">&#10003;</div>
    <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Gmail authorized</h1>
    <p style="color: #71717a; font-size: 14px;">You can close this tab and return to your terminal.</p>
  </div>
</body>
</html>`;
}

/** HTML shown in the browser after failed authorization */
function errorHtml(error: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>upiagent — Authorization failed</title></head>
<body style="font-family: system-ui; background: #09090b; color: #fafafa; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0;">
  <div style="text-align: center; max-width: 400px;">
    <div style="font-size: 48px; margin-bottom: 16px;">✗</div>
    <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 8px;">Authorization failed</h1>
    <p style="color: #71717a; font-size: 14px;">${error}</p>
  </div>
</body>
</html>`;
}
