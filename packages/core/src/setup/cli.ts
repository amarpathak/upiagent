#!/usr/bin/env node

/**
 * upiagent CLI
 *
 * Commands:
 *   npx upiagent setup    — Interactive Gmail OAuth setup
 *   npx upiagent          — Show help
 *   npx upiagent version  — Show version
 */

import { setupGmailAuth } from "./gmail-auth.js";
import { createInterface } from "readline";

const VERSION = "0.1.0";

function ask(rl: ReturnType<typeof createInterface>, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer.trim());
    });
  });
}

function showHelp() {
  // eslint-disable-next-line no-console
  console.log(`
  upiagent v${VERSION}

  UPI payment gateway — QR generation + Gmail verification + LLM parsing.

  Commands:

    setup      Interactive Gmail OAuth setup. Opens your browser,
               gets a refresh token, outputs .env values.

    version    Show version number.

  Usage:

    npx upiagent setup
    npx upiagent version

  Docs: https://github.com/AmarPathak/upiagent
`);
}

async function runSetup() {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  // eslint-disable-next-line no-console
  console.log(`
  upiagent setup — Gmail OAuth

  Prerequisites:
    1. A Google Cloud project
    2. Gmail API enabled
    3. OAuth 2.0 credentials (Desktop app type)

  Guide: https://github.com/AmarPathak/upiagent/blob/main/docs/gmail-setup.md
`);

  const clientId = await ask(rl, "  Client ID: ");
  if (!clientId) {
    // eslint-disable-next-line no-console
    console.error("\n  Error: Client ID is required.");
    process.exit(1);
  }

  const clientSecret = await ask(rl, "  Client Secret: ");
  if (!clientSecret) {
    // eslint-disable-next-line no-console
    console.error("\n  Error: Client Secret is required.");
    process.exit(1);
  }

  rl.close();

  // eslint-disable-next-line no-console
  console.log("\n  Opening browser for authorization...\n");

  try {
    const result = await setupGmailAuth({
      clientId,
      clientSecret,
      openBrowser: true,
    });

    // eslint-disable-next-line no-console
    console.log(`
  ✓ Gmail authorized.

  Add to your .env:

  GMAIL_CLIENT_ID=${clientId}
  GMAIL_CLIENT_SECRET=${clientSecret}
  GMAIL_REFRESH_TOKEN=${result.refreshToken}
`);
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(
      "\n  Error:",
      error instanceof Error ? error.message : String(error),
    );
    process.exit(1);
  }
}

async function main() {
  const command = process.argv[2];

  switch (command) {
    case "setup":
      await runSetup();
      break;

    case "version":
    case "--version":
    case "-v":
      // eslint-disable-next-line no-console
      console.log(VERSION);
      break;

    case "help":
    case "--help":
    case "-h":
    case undefined:
      showHelp();
      break;

    default:
      // eslint-disable-next-line no-console
      console.error(`  Unknown command: ${command}\n`);
      showHelp();
      process.exit(1);
  }
}

main();
