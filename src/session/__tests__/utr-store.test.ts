import { describe, it, expect, beforeEach } from "vitest";
import { InMemoryUtrStore } from "../utr-store.js";

describe("InMemoryUtrStore", () => {
  let store: InMemoryUtrStore;

  beforeEach(() => {
    store = new InMemoryUtrStore();
  });

  describe("register", () => {
    it("stores a UTR for a session", () => {
      store.register("session-1", "412345678901", "text");
      const utrs = store.getSessionUtrs("session-1");
      expect(utrs).toHaveLength(1);
      expect(utrs[0]!.utr).toBe("412345678901");
      expect(utrs[0]!.source).toBe("text");
    });

    it("normalizes UTR before storing", () => {
      store.register("session-1", "  utr412345678901  ", "text");
      const utrs = store.getSessionUtrs("session-1");
      expect(utrs[0]!.utr).toBe("412345678901");
    });

    it("supports multiple UTRs per session", () => {
      store.register("session-1", "412345678901", "text");
      store.register("session-1", "912345678901", "ocr");
      expect(store.getSessionUtrs("session-1")).toHaveLength(2);
    });

    it("deduplicates same UTR within a session", () => {
      store.register("session-1", "412345678901", "text");
      store.register("session-1", "412345678901", "ocr");
      expect(store.getSessionUtrs("session-1")).toHaveLength(1);
    });

    it("rejects UTRs shorter than 9 characters", () => {
      store.register("session-1", "12345", "text");
      expect(store.getSessionUtrs("session-1")).toHaveLength(0);
    });
  });

  describe("findSessionByUtr", () => {
    it("finds session by registered UTR", () => {
      store.register("session-1", "412345678901", "text");
      expect(store.findSessionByUtr("412345678901")).toBe("session-1");
    });

    it("finds session with normalized lookup", () => {
      store.register("session-1", "412345678901", "text");
      // Look up with different casing/spacing
      expect(store.findSessionByUtr("  412345678901  ")).toBe("session-1");
    });

    it("returns undefined for unknown UTR", () => {
      expect(store.findSessionByUtr("999999999999")).toBeUndefined();
    });

    it("latest registration wins for same UTR across sessions", () => {
      store.register("session-1", "412345678901", "text");
      store.register("session-2", "412345678901", "text");
      expect(store.findSessionByUtr("412345678901")).toBe("session-2");
    });
  });

  describe("getExpectedUtrs", () => {
    it("returns normalized UTR strings for a session", () => {
      store.register("session-1", "412345678901", "text");
      store.register("session-1", "HDFC012345678901", "text");
      const expected = store.getExpectedUtrs("session-1");
      expect(expected).toEqual(["412345678901", "HDFC012345678901"]);
    });

    it("returns empty array for unknown session", () => {
      expect(store.getExpectedUtrs("unknown")).toEqual([]);
    });
  });

  describe("removeSession", () => {
    it("removes all UTRs for a session", () => {
      store.register("session-1", "412345678901", "text");
      store.register("session-1", "912345678901", "text");
      store.removeSession("session-1");

      expect(store.getSessionUtrs("session-1")).toHaveLength(0);
      expect(store.findSessionByUtr("412345678901")).toBeUndefined();
      expect(store.findSessionByUtr("912345678901")).toBeUndefined();
    });

    it("does not affect other sessions", () => {
      store.register("session-1", "412345678901", "text");
      store.register("session-2", "912345678901", "text");
      store.removeSession("session-1");

      expect(store.findSessionByUtr("912345678901")).toBe("session-2");
    });

    it("only removes reverse index if session still owns it", () => {
      store.register("session-1", "412345678901", "text");
      store.register("session-2", "412345678901", "text"); // session-2 now owns it
      store.removeSession("session-1");

      // session-2 should still own the UTR
      expect(store.findSessionByUtr("412345678901")).toBe("session-2");
    });

    it("is safe to call on non-existent session", () => {
      expect(() => store.removeSession("nonexistent")).not.toThrow();
    });
  });
});
