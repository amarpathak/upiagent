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

/**
 * Set of known bank sender email addresses, extracted from the default query.
 * Used for post-fetch validation to ensure emails genuinely came from trusted senders.
 */
const KNOWN_BANK_SENDERS: Set<string> = new Set([
  "alerts@hdfcbank.net",
  "alerts@hdfcbank.bank.in",
  "alerts@icicibank.com",
  "alerts@axisbank.com",
  "noreply@sbi.co.in",
  "alerts@kotak.com",
  "alerts@yesbank.in",
  "alerts@pnb.co.in",
  "alerts@bankofbaroda.co.in",
  "alerts@indusind.com",
  "noreply@paytm.com",
  "noreply@phonepe.com",
  "noreply@googlepay.com",
]);

/**
 * Extracts the raw email address from a `from` header value.
 * Handles both "Name <email@example.com>" and plain "email@example.com" formats.
 */
function extractEmailAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim().toLowerCase();
}

/**
 * Validates that an email's sender is in the known bank senders list.
 * Returns true if valid, false (with a console warning) if not.
 */
function validateSender(from: string): boolean {
  const email = extractEmailAddress(from);
  if (KNOWN_BANK_SENDERS.has(email)) {
    return true;
  }
  console.warn(
    `[GmailClient] Filtered out email from unknown sender: ${from}`,
  );
  return false;
}

export interface GmailWatchResult {
  historyId: string;
  expiration: string; // epoch ms as string
}

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
   * Start a Gmail push notification watch on this inbox.
   *
   * Google will POST to your Pub/Sub topic whenever a new message arrives.
   * The watch expires after ~7 days — caller is responsible for renewal.
   *
   * @param topicName Full Pub/Sub topic name: "projects/YOUR_PROJECT/topics/YOUR_TOPIC"
   * @returns historyId (current state) and expiration timestamp
   */
  async watch(topicName: string): Promise<GmailWatchResult> {
    const res = await this.gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName,
        labelIds: ["INBOX"],
      },
    });
    return {
      historyId: res.data.historyId!,
      expiration: res.data.expiration!,
    };
  }

  /**
   * Stop the Gmail push watch for this inbox.
   */
  async stopWatch(): Promise<void> {
    await this.gmail.users.stop({ userId: "me" });
  }

  /**
   * Fetch all new messages since a given historyId (delta sync).
   *
   * Called inside the Pub/Sub push handler to get only the emails that
   * arrived since the last known state — avoids re-processing old emails.
   *
   * @param startHistoryId The historyId from the last watch or push notification
   * @returns New EmailMessages since that point, filtered to known bank senders
   */
  async fetchSinceHistory(startHistoryId: string): Promise<EmailMessage[]> {
    let res;
    try {
      res = await this.gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
      });
    } catch (err: unknown) {
      // historyId too old — fall back to recent emails (last 5 min)
      if (
        typeof err === "object" &&
        err !== null &&
        "code" in err &&
        (err as { code: number }).code === 404
      ) {
        console.warn("[GmailClient] historyId expired, falling back to 5-min lookback");
        return this.fetchBankAlerts({ lookbackMinutes: 5, maxResults: 5 });
      }
      throw err;
    }

    const addedMessages = (res.data.history ?? [])
      .flatMap((h) => h.messagesAdded ?? [])
      .map((m) => m.message)
      .filter((m): m is NonNullable<typeof m> => !!m?.id);

    if (addedMessages.length === 0) return [];

    const messages = await Promise.all(
      addedMessages.map(async (msg) => {
        const detail = await this.gmail.users.messages.get({
          userId: "me",
          id: msg.id!,
          format: "full",
        });
        return parseGmailMessage(detail.data);
      }),
    );

    const parsed = messages.filter((msg): msg is EmailMessage => msg !== null);
    return parsed.filter((msg) => validateSender(msg.from));
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

    const parsed = messages.filter((msg): msg is EmailMessage => msg !== null);

    // Post-fetch sender validation: even though the Gmail query filters by
    // sender, the `from` field could be spoofed or the query could be
    // overridden via options.query. Filter out anything not from a known bank.
    return parsed.filter((msg) => validateSender(msg.from));
  }
}
