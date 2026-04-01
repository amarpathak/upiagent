import type { DedupStore } from "./dedup.js";
import { Logger } from "../utils/logger.js";

interface PgPool {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}

const DEFAULT_TABLE = "payment_dedup";
const DEFAULT_TTL_MINUTES = 60;

export class PostgresDedupStore implements DedupStore {
  private readonly pool: PgPool;
  private readonly table: string;
  private readonly logger: Logger;

  constructor(pool: PgPool, tableName?: string, logger?: Logger) {
    this.pool = pool;
    this.table = tableName ?? DEFAULT_TABLE;
    this.logger = logger ?? new Logger({ level: "warn" });
  }

  async has(referenceId: string): Promise<boolean> {
    try {
      const result = await this.pool.query(
        `SELECT reference_id FROM ${this.table} WHERE reference_id = $1 AND expires_at > NOW()`,
        [referenceId]
      );
      return result.rows.length > 0;
    } catch (error) {
      this.logger.error("PostgresDedupStore.has() failed", {
        referenceId,
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async add(referenceId: string, ttlMinutes?: number): Promise<void> {
    const ttl = ttlMinutes ?? DEFAULT_TTL_MINUTES;
    try {
      await this.pool.query(
        `INSERT INTO ${this.table} (reference_id, expires_at)
         VALUES ($1, NOW() + INTERVAL '1 minute' * $2)
         ON CONFLICT (reference_id) DO NOTHING`,
        [referenceId, ttl]
      );
    } catch (error) {
      this.logger.error("PostgresDedupStore.add() failed", {
        referenceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
