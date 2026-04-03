import { describe, it, expect, vi, beforeEach } from "vitest";
import { PostgresDedupStore } from "../dedup-postgres.js";

function createMockPool() {
  const queryResults: { rows: Record<string, unknown>[] }[] = [];
  const queryCalls: { text: string; values: unknown[] }[] = [];

  const pool = {
    query: vi.fn(async (text: string, values: unknown[]) => {
      queryCalls.push({ text, values });
      return queryResults.shift() ?? { rows: [] };
    }),
    _queryCalls: queryCalls,
    _pushResult: (rows: Record<string, unknown>[]) => queryResults.push({ rows }),
  };
  return pool;
}

describe("PostgresDedupStore", () => {
  let pool: ReturnType<typeof createMockPool>;
  let store: PostgresDedupStore;

  beforeEach(() => {
    pool = createMockPool();
    store = new PostgresDedupStore(pool as any);
  });

  describe("has()", () => {
    it("returns false when reference not found", async () => {
      pool._pushResult([]);
      const result = await store.has("ref123");
      expect(result).toBe(false);
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT"),
        expect.arrayContaining(["ref123"])
      );
    });

    it("returns true when reference exists and not expired", async () => {
      pool._pushResult([{ reference_id: "ref123" }]);
      const result = await store.has("ref123");
      expect(result).toBe(true);
    });
  });

  describe("add()", () => {
    it("inserts with default TTL", async () => {
      pool._pushResult([]);
      await store.add("ref456");
      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT"),
        expect.arrayContaining(["ref456"])
      );
    });

    it("inserts with custom TTL", async () => {
      pool._pushResult([]);
      await store.add("ref789", 120);
      const call = pool._queryCalls[0]!;
      expect(call.text).toContain("INSERT");
      expect(call.values).toContain("ref789");
    });

    it("uses ON CONFLICT DO NOTHING for idempotency", async () => {
      pool._pushResult([]);
      await store.add("ref-dup");
      const call = pool._queryCalls[0]!;
      expect(call.text).toContain("ON CONFLICT");
    });
  });

  describe("fail-closed behavior", () => {
    it("returns true on query error (fail-closed to prevent double-spend)", async () => {
      pool.query.mockRejectedValueOnce(new Error("relation does not exist"));
      const result = await store.has("ref-err");
      expect(result).toBe(true);
    });

    it("throws on add failure (callers must know ref wasn't persisted)", async () => {
      pool.query.mockRejectedValueOnce(new Error("connection refused"));
      await expect(store.add("ref-err2")).rejects.toThrow("connection refused");
    });
  });
});
