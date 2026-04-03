import { describe, it, expect } from "vitest";
import { extractUtrFromText, normalizeUtr } from "../utr-parser.js";

describe("normalizeUtr", () => {
  it("uppercases and trims", () => {
    expect(normalizeUtr("  abc123def456  ")).toBe("ABC123DEF456");
  });

  it("strips UTR prefix", () => {
    expect(normalizeUtr("UTR412345678901")).toBe("412345678901");
  });

  it("strips REF prefix", () => {
    expect(normalizeUtr("REF412345678901")).toBe("412345678901");
  });

  it("strips # prefix", () => {
    expect(normalizeUtr("#412345678901")).toBe("412345678901");
  });

  it("collapses whitespace", () => {
    expect(normalizeUtr("4123 4567 8901")).toBe("412345678901");
  });

  it("handles combined prefixes", () => {
    expect(normalizeUtr("UTR#412345678901")).toBe("412345678901");
  });
});

describe("extractUtrFromText", () => {
  describe("Pattern 1: Labeled extraction", () => {
    it("extracts UTR with 'UTR:' label", () => {
      const result = extractUtrFromText("Payment successful. UTR: 412345678901");
      expect(result).toHaveLength(1);
      expect(result[0]!.utr).toBe("412345678901");
      expect(result[0]!.source).toBe("labeled");
      expect(result[0]!.confidence).toBe(0.95);
    });

    it("extracts UTR with 'UPI Ref No' label", () => {
      const result = extractUtrFromText("UPI Ref No: 412345678901");
      expect(result).toHaveLength(1);
      expect(result[0]!.utr).toBe("412345678901");
      expect(result[0]!.source).toBe("labeled");
    });

    it("extracts UTR with 'Ref No' label", () => {
      const result = extractUtrFromText("Ref No - 412345678901");
      expect(result).toHaveLength(1);
      expect(result[0]!.utr).toBe("412345678901");
    });

    it("extracts UTR with 'Transaction ID' label", () => {
      const result = extractUtrFromText("Transaction ID: HDFC0012345678901");
      expect(result).toHaveLength(1);
      expect(result[0]!.utr).toBe("HDFC0012345678901");
      expect(result[0]!.source).toBe("labeled");
    });

    it("extracts UTR with 'Bank Ref No' label", () => {
      const result = extractUtrFromText("Bank Ref No. 412345678901");
      expect(result).toHaveLength(1);
      expect(result[0]!.utr).toBe("412345678901");
    });

    it("extracts UTR with 'Reference Number' label", () => {
      const result = extractUtrFromText("Reference Number: 412345678901");
      expect(result).toHaveLength(1);
      expect(result[0]!.utr).toBe("412345678901");
    });
  });

  describe("Pattern 2a: 12-digit IMPS UTR", () => {
    it("extracts standalone 12-digit number", () => {
      const result = extractUtrFromText("Your payment 412345678901 is confirmed");
      expect(result.some((c) => c.utr === "412345678901")).toBe(true);
    });

    it("does not extract numbers shorter than 12 digits", () => {
      const result = extractUtrFromText("Amount: 49900");
      // 49900 is only 5 digits, should not match IMPS pattern
      expect(result.filter((c) => c.source === "imps")).toHaveLength(0);
    });

    it("does not extract numbers longer than 12 digits as IMPS", () => {
      const result = extractUtrFromText("ID: 4123456789012345");
      // 16 digits — not a 12-digit IMPS match (word boundary won't match)
      expect(result.filter((c) => c.source === "imps")).toHaveLength(0);
    });
  });

  describe("Pattern 2b: NEFT/RTGS UTR", () => {
    it("extracts 4-letter + 12-digit pattern", () => {
      // Note: "ref" in the text triggers labeled pattern first, so source is "labeled"
      // Test with no label to verify pure NEFT detection
      const result = extractUtrFromText("Transfer complete HDFC012345678901 done");
      expect(result.some((c) => c.utr === "HDFC012345678901" && c.source === "neft")).toBe(true);
    });

    it("is case-insensitive for bank code", () => {
      const result = extractUtrFromText("Confirmed hdfc012345678901 completed");
      expect(result.some((c) => c.utr === "HDFC012345678901")).toBe(true);
    });
  });

  describe("Pattern 3: Fallback", () => {
    it("uses fallback only when no higher-priority match", () => {
      // No labeled, IMPS, or NEFT matches — should try fallback
      // Use text without any label-like words (ref, transaction, etc.)
      const result = extractUtrFromText("Your code is X1234567890123456 please save it");
      expect(result.some((c) => c.source === "fallback")).toBe(true);
    });

    it("skips fallback when labeled match exists (PhonePe protection)", () => {
      // Has a labeled match — fallback should not fire
      const text = "UPI Transaction ID: T2403011234567890 UPI Ref No: 412345678901";
      const result = extractUtrFromText(text);
      // Should have the labeled matches but no fallback
      expect(result.filter((c) => c.source === "fallback")).toHaveLength(0);
      expect(result.filter((c) => c.source === "labeled")).toHaveLength(2);
    });
  });

  describe("Deduplication", () => {
    it("deduplicates same UTR from different patterns", () => {
      // "UTR: 412345678901" matches both labeled AND IMPS
      const result = extractUtrFromText("UTR: 412345678901");
      const normalized = result.filter((c) => c.utr === "412345678901");
      expect(normalized).toHaveLength(1);
      // Should keep the higher-confidence labeled version
      expect(normalized[0]!.source).toBe("labeled");
    });
  });

  describe("Edge cases", () => {
    it("returns empty array for no matches", () => {
      expect(extractUtrFromText("Hello, how are you?")).toHaveLength(0);
    });

    it("returns empty array for empty string", () => {
      expect(extractUtrFromText("")).toHaveLength(0);
    });

    it("handles multiple UTRs in same text", () => {
      const text = "UTR: 412345678901. Also see Ref No: 912345678901";
      const result = extractUtrFromText(text);
      expect(result.length).toBeGreaterThanOrEqual(2);
    });

    it("sorts by confidence descending", () => {
      const result = extractUtrFromText("UTR: 412345678901 and also 912345678901");
      for (let i = 1; i < result.length; i++) {
        expect(result[i - 1]!.confidence).toBeGreaterThanOrEqual(result[i]!.confidence);
      }
    });

    it("rejects UTRs shorter than 9 characters after normalization", () => {
      const result = extractUtrFromText("Ref: AB12");
      expect(result).toHaveLength(0);
    });
  });

  describe("Real-world bank alert snippets", () => {
    it("parses HDFC bank alert", () => {
      const text = "Rs.499.00 credited to a/c XX1234 by UPI-Ref No 412345678901";
      const result = extractUtrFromText(text);
      expect(result.some((c) => c.utr === "412345678901")).toBe(true);
    });

    it("parses SBI alert", () => {
      const text = "INR 1000 credited to your A/c. UTR: 312345678901";
      const result = extractUtrFromText(text);
      expect(result[0]!.utr).toBe("312345678901");
      expect(result[0]!.source).toBe("labeled");
    });

    it("parses PhonePe screenshot text", () => {
      const text = `Payment Successful
        Amount: Rs.499
        UPI Transaction ID: T2403011234567890123456
        UPI Ref No: 412345678901`;
      const result = extractUtrFromText(text);
      // Should have both labeled matches
      const labeled = result.filter((c) => c.source === "labeled");
      expect(labeled.length).toBeGreaterThanOrEqual(2);
      // Real UTR (UPI Ref No) should be present
      expect(result.some((c) => c.utr === "412345678901")).toBe(true);
    });
  });
});
