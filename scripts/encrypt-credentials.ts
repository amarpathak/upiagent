/**
 * One-off migration: encrypt all plaintext Gmail credentials in the merchants table.
 *
 * Usage:
 *   npx tsx scripts/encrypt-credentials.ts
 *
 * Requires:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CREDENTIALS_ENCRYPTION_KEY
 *   (reads from apps/dashboard/.env.local)
 */

import { createClient } from "@supabase/supabase-js";
import { encrypt, isEncrypted } from "@upiagent/core";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load env from dashboard
const envPath = resolve(import.meta.dirname ?? ".", "../apps/dashboard/.env.local");
const envFile = readFileSync(envPath, "utf-8");
const env: Record<string, string> = {};
for (const line of envFile.split("\n")) {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1]!.trim()] = match[2]!.trim();
}

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];
const ENC_KEY = env["CREDENTIALS_ENCRYPTION_KEY"];

if (!SUPABASE_URL || !SERVICE_KEY || !ENC_KEY) {
  console.error("Missing required env vars. Check apps/dashboard/.env.local has:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CREDENTIALS_ENCRYPTION_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const SENSITIVE_COLUMNS = [
  "gmail_refresh_token",
  "gmail_client_secret",
  "llm_api_key",
  "webhook_secret",
] as const;

async function main() {
  console.log("Fetching all merchants...");

  const { data: merchants, error } = await supabase
    .from("merchants")
    .select("id, gmail_refresh_token, gmail_client_secret, llm_api_key, webhook_secret");

  if (error) {
    console.error("Failed to fetch merchants:", error.message);
    process.exit(1);
  }

  if (!merchants || merchants.length === 0) {
    console.log("No merchants found.");
    return;
  }

  console.log(`Found ${merchants.length} merchant(s). Checking for plaintext credentials...\n`);

  let updated = 0;

  for (const merchant of merchants) {
    const updates: Record<string, string> = {};

    for (const col of SENSITIVE_COLUMNS) {
      const value = merchant[col];
      if (value && !isEncrypted(value)) {
        updates[col] = encrypt(value, ENC_KEY);
        console.log(`  [${merchant.id}] ${col}: plaintext → encrypted`);
      }
    }

    if (Object.keys(updates).length > 0) {
      updates["updated_at"] = new Date().toISOString();
      const { error: updateError } = await supabase
        .from("merchants")
        .update(updates)
        .eq("id", merchant.id);

      if (updateError) {
        console.error(`  [${merchant.id}] UPDATE FAILED: ${updateError.message}`);
      } else {
        updated++;
        console.log(`  [${merchant.id}] updated\n`);
      }
    } else {
      console.log(`  [${merchant.id}] all credentials already encrypted or empty`);
    }
  }

  console.log(`\nDone. ${updated}/${merchants.length} merchant(s) updated.`);
}

main();
