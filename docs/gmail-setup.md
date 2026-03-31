# Gmail API Setup Guide

This guide walks you through setting up Gmail API access for upiagent.

## 1. Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click **Select a project** → **New Project**
3. Name it (e.g., "upiagent") → **Create**

## 2. Enable Gmail API

1. In your project, go to **APIs & Services** → **Library**
2. Search for "Gmail API"
3. Click **Enable**

## 3. Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type → **Create**
3. Fill in:
   - App name: "upiagent" (or your app name)
   - User support email: your email
   - Developer contact: your email
4. Click **Save and Continue** through Scopes and Test Users
5. Under **Test Users**, add the Gmail account you want to read bank alerts from

## 4. Create OAuth Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth Client ID**
3. Application type: **Desktop app** (NOT Web application)
4. Name: "upiagent"
5. Click **Create**
6. Download the JSON file — you'll need `client_id` and `client_secret` from it

## 5. Generate a Refresh Token

The refresh token is what lets upiagent access Gmail without user interaction.

### Option A: OAuth Playground (Quickest)

1. Go to [Google OAuth Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (top right) → Check **Use your own OAuth credentials**
3. Enter your `client_id` and `client_secret`
4. In Step 1, find **Gmail API v1** → Select `https://www.googleapis.com/auth/gmail.readonly`
5. Click **Authorize APIs** → Sign in with your Gmail account → Allow
6. In Step 2, click **Exchange authorization code for tokens**
7. Copy the `refresh_token` from the response

### Option B: Script (Programmatic)

```typescript
import { google } from "googleapis";
import http from "http";
import url from "url";

const CLIENT_ID = "your-client-id";
const CLIENT_SECRET = "your-client-secret";
const REDIRECT_URI = "http://localhost:3000/callback";

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Step 1: Generate consent URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline", // This is what gives us a refresh token
  scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  prompt: "consent", // Force consent to always get refresh_token
});

console.log("Open this URL in your browser:", authUrl);

// Step 2: Listen for the callback
const server = http.createServer(async (req, res) => {
  const query = url.parse(req.url!, true).query;
  if (query.code) {
    const { tokens } = await oauth2Client.getToken(query.code as string);
    console.log("\n=== Your credentials ===");
    console.log("Refresh Token:", tokens.refresh_token);
    res.end("Done! Check your terminal for the refresh token.");
    server.close();
  }
});

server.listen(3000);
```

## 6. Store Your Credentials

Create a `.env` file (DO NOT commit this to git):

```env
GMAIL_CLIENT_ID=your-client-id.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=your-client-secret
GMAIL_REFRESH_TOKEN=your-refresh-token
```

Then use them:

```typescript
const agent = new UpiAgent({
  gmail: {
    clientId: process.env.GMAIL_CLIENT_ID!,
    clientSecret: process.env.GMAIL_CLIENT_SECRET!,
    refreshToken: process.env.GMAIL_REFRESH_TOKEN!,
  },
  // ...
});
```

## Important Notes

- The Gmail scope is **read-only** (`gmail.readonly`) — upiagent never sends or modifies emails
- Refresh tokens don't expire unless the user revokes access
- While your app is in "Testing" mode in Google Cloud, only users listed as Test Users can authenticate
- To move to production, submit for Google verification (requires a privacy policy and domain)

## Troubleshooting

**"Token has been expired or revoked"**
→ Generate a new refresh token. This happens if you regenerate the client secret or the user revokes access.

**"Request had insufficient authentication scopes"**
→ The refresh token was generated without the `gmail.readonly` scope. Regenerate with the correct scope.

**"Access blocked: This app is not verified"**
→ Your app is in Testing mode and the Gmail account isn't listed as a Test User. Add it in the OAuth consent screen.
