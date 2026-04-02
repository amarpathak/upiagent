import { createClient } from "@libsql/client";

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) throw new Error("TURSO_DATABASE_URL is not set");

export const db = createClient({ url, authToken });

export async function initDb() {
  await db.batch([
    `CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      subtasks TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL,
      expanded_at INTEGER
    )`,
    `CREATE TABLE IF NOT EXISTS user_facts (
      id TEXT PRIMARY KEY,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS patterns (
      id TEXT PRIMARY KEY,
      observation TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )`,
  ]);
}
