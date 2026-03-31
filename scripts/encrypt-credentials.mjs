/**
 * One-off migration: encrypt all plaintext credentials in merchants table.
 * Usage: node scripts/encrypt-credentials.mjs
 */

import { createCipheriv, randomBytes } from "crypto";
import { readFileSync } from "fs";

// ── Inline encrypt + isEncrypted (avoid module resolution issues) ──
function encrypt(plaintext, keyHex) {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

function isEncrypted(value) {
  if (!value) return false;
  const parts = value.split(":");
  return parts.length === 3 && parts[0].length === 24 && parts[1].length === 32;
}

// ── Load env ──
const envFile = readFileSync(new URL("../apps/dashboard/.env.local", import.meta.url), "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (m) env[m[1].trim()] = m[2].trim();
}

const SUPABASE_URL = env["NEXT_PUBLIC_SUPABASE_URL"];
const SERVICE_KEY = env["SUPABASE_SERVICE_ROLE_KEY"];
const ENC_KEY = env["CREDENTIALS_ENCRYPTION_KEY"];

if (!SUPABASE_URL || !SERVICE_KEY || !ENC_KEY) {
  console.error("Missing env vars in apps/dashboard/.env.local");
  process.exit(1);
}

// ── Inline Supabase client (REST API, no SDK needed) ──
async function supabaseSelect(table, columns) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`SELECT failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function supabaseUpdate(table, id, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(`UPDATE failed: ${res.status} ${await res.text()}`);
}

// ── Main ──
const COLS = ["gmail_refresh_token", "gmail_client_secret", "llm_api_key", "webhook_secret"];

console.log("Fetching merchants...");
const merchants = await supabaseSelect("merchants", `id,${COLS.join(",")}`);

if (!merchants?.length) { console.log("No merchants."); process.exit(0); }

console.log(`Found ${merchants.length} merchant(s)\n`);
let updated = 0;

for (const m of merchants) {
  const updates = {};

  for (const col of COLS) {
    const val = m[col];
    if (val && !isEncrypted(val)) {
      updates[col] = encrypt(val, ENC_KEY);
      console.log(`  [${m.id}] ${col}: plaintext → encrypted`);
    }
  }

  if (Object.keys(updates).length > 0) {
    updates["updated_at"] = new Date().toISOString();
    try {
      await supabaseUpdate("merchants", m.id, updates);
      updated++;
      console.log(`  [${m.id}] done\n`);
    } catch (err) {
      console.error(`  [${m.id}] FAILED: ${err.message}`);
    }
  } else {
    console.log(`  [${m.id}] already encrypted or empty`);
  }
}

console.log(`\n${updated}/${merchants.length} merchant(s) encrypted.`);
