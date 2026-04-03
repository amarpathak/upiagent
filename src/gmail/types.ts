/**
 * Gmail Adapter Types
 *
 * These types define the contract between the Gmail adapter and the rest of
 * upiagent. By defining types first, we get two benefits:
 * 1. The LLM parser (Phase 2) can be built against these types without
 *    needing a working Gmail connection
 * 2. We can mock these types in tests without touching the Gmail API
 *
 * This is "interface-first design" — an FDE pattern where you define the
 * shape of data flowing between modules before implementing either side.
 */

/**
 * Credentials needed to authenticate with Gmail API.
 *
 * These come from Google Cloud Console. The consumer sets up a project once,
 * creates OAuth2 credentials, and generates a refresh token. We use the
 * refresh token to silently get access tokens without user interaction.
 */
export interface GmailCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

/**
 * A simplified representation of a Gmail message.
 *
 * The raw Gmail API returns deeply nested MIME structures with base64-encoded
 * parts. We flatten it into something the LLM parser can work with cleanly.
 * This is a common FDE pattern: create an "adapter layer" that translates
 * a messy external API into a clean internal model.
 */
export interface EmailMessage {
  /** Gmail's internal message ID — used for deduplication */
  id: string;

  /** Email subject line — often contains the amount for bank alerts */
  subject: string;

  /** Plain text body — extracted from MIME parts, HTML tags stripped */
  body: string;

  /** Sender email address — used to identify which bank sent the alert */
  from: string;

  /** When the email was received — used for time window verification */
  receivedAt: Date;

  /**
   * Raw Authentication-Results header from Gmail.
   * Contains DKIM, SPF, and DMARC verification results.
   * Used by the security validator to detect spoofed bank emails.
   */
  authResults?: string;
}

/**
 * Options for searching Gmail for bank alert emails.
 */
export interface GmailSearchOptions {
  /** How many minutes back to search (default: 30) */
  lookbackMinutes?: number;

  /** Maximum number of emails to fetch (default: 10) */
  maxResults?: number;

  /**
   * Custom Gmail search query override.
   * If not provided, we use a default query that searches for common
   * Indian bank alert sender addresses.
   *
   * Gmail search syntax: https://support.google.com/mail/answer/7190
   * Example: "from:alerts@hdfcbank.net subject:payment"
   */
  query?: string;
}
