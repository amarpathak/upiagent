/**
 * Gmail API Client
 *
 * Handles authentication and email fetching. Uses the extracted parser
 * module for all MIME parsing logic (so it can be tested independently).
 */

import { google } from "googleapis";
import type { gmail_v1 } from "googleapis";
import type { GmailCredentials, EmailMessage, GmailSearchOptions } from "./types.js";
import { parseGmailMessage } from "./parser.js";

/**
 * Default Gmail search query for Indian bank UPI alerts.
 *
 * Covers major banks + UPI apps. The LLM parser in Phase 2 will handle
 * the intelligent extraction — this query just casts a wide net to
 * catch any email that MIGHT be a bank alert.
 */
const DEFAULT_BANK_ALERT_QUERY = [
  "from:alerts@hdfcbank.net",
  "from:alerts@hdfcbank.bank.in",
  "from:alerts@icicibank.com",
  "from:alerts@axisbank.com",
  "from:noreply@sbi.co.in",
  "from:alerts@kotak.com",
  "from:alerts@yesbank.in",
  "from:alerts@pnb.co.in",
  "from:alerts@bankofbaroda.co.in",
  "from:alerts@indusind.com",
  "from:noreply@paytm.com",
  "from:noreply@phonepe.com",
  "from:noreply@googlepay.com",
].join(" OR ");

export class GmailClient {
  private gmail: gmail_v1.Gmail;

  constructor(credentials: GmailCredentials) {
    const oauth2Client = new google.auth.OAuth2(
      credentials.clientId,
      credentials.clientSecret,
      "urn:ietf:wg:oauth:2.0:oob",
    );

    oauth2Client.setCredentials({
      refresh_token: credentials.refreshToken,
    });

    this.gmail = google.gmail({ version: "v1", auth: oauth2Client });
  }

  /**
   * Fetches recent bank alert emails from Gmail.
   *
   * Two-step process:
   * 1. Search for message IDs (lightweight)
   * 2. Fetch full content for each ID (parallel)
   */
  async fetchBankAlerts(options: GmailSearchOptions = {}): Promise<EmailMessage[]> {
    const { lookbackMinutes = 30, maxResults = 10, query } = options;

    const afterTimestamp = Math.floor((Date.now() - lookbackMinutes * 60 * 1000) / 1000);
    const searchQuery = query
      ? `${query} after:${afterTimestamp}`
      : `(${DEFAULT_BANK_ALERT_QUERY}) after:${afterTimestamp}`;

    const listResponse = await this.gmail.users.messages.list({
      userId: "me",
      q: searchQuery,
      maxResults,
    });

    const messageIds = listResponse.data.messages ?? [];

    if (messageIds.length === 0) {
      return [];
    }

    const messages = await Promise.all(
      messageIds.map(async (msg) => {
        if (!msg.id) return null;

        const detail = await this.gmail.users.messages.get({
          userId: "me",
          id: msg.id,
          format: "full",
        });

        // Parsing is delegated to the parser module — pure functions
        // that are tested independently in gmail.test.ts
        return parseGmailMessage(detail.data);
      }),
    );

    return messages.filter((msg): msg is EmailMessage => msg !== null);
  }
}
