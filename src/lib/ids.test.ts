import { describe, expect, it } from "vitest";
import {
  buildProductCodePrefix,
  formatOrderNumber,
  formatTicketNumber,
  generateBuildShortId,
  generateCartToken,
  isValidOrderNumber,
  isValidTicketNumber,
} from "./ids";

describe("generateBuildShortId", () => {
  it("generates an 8-character base58 string", () => {
    const id = generateBuildShortId();
    expect(id).toHaveLength(8);
    expect(id).toMatch(/^[1-9A-HJ-NP-Za-km-z]{8}$/);
  });

  it("generates different IDs across calls (probabilistically)", () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateBuildShortId()));
    expect(ids.size).toBe(50);
  });
});

describe("generateCartToken", () => {
  it("generates a 32-character base58 string", () => {
    const token = generateCartToken();
    expect(token).toHaveLength(32);
    expect(token).toMatch(/^[1-9A-HJ-NP-Za-km-z]{32}$/);
  });

  it("generates different tokens across calls (probabilistically)", () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateCartToken()));
    expect(tokens.size).toBe(50);
  });
});

describe("formatOrderNumber", () => {
  it("formats with zero-padded month, 2-digit year, and 4-digit sequence", () => {
    expect(formatOrderNumber(2026, 7, 42)).toBe("CC-2607-0042");
  });

  it("pads a sequence beyond 4 digits without truncation", () => {
    expect(formatOrderNumber(2026, 7, 12345)).toBe("CC-2607-12345");
  });

  it("pads single-digit months", () => {
    expect(formatOrderNumber(2026, 1, 1)).toBe("CC-2601-0001");
  });
});

describe("isValidOrderNumber", () => {
  it("accepts a well-formed order number", () => {
    expect(isValidOrderNumber("CC-2607-0042")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isValidOrderNumber("CC-267-0042")).toBe(false);
    expect(isValidOrderNumber("SVC-2607-0042")).toBe(false);
    expect(isValidOrderNumber("random string")).toBe(false);
  });
});

describe("formatTicketNumber", () => {
  it("formats with the SVC prefix", () => {
    expect(formatTicketNumber(2026, 7, 42)).toBe("SVC-2607-0042");
  });
});

describe("isValidTicketNumber", () => {
  it("accepts a well-formed ticket number", () => {
    expect(isValidTicketNumber("SVC-2607-0042")).toBe(true);
  });

  it("rejects malformed input", () => {
    expect(isValidTicketNumber("CC-2607-0042")).toBe(false);
    expect(isValidTicketNumber("")).toBe(false);
  });
});

describe("buildProductCodePrefix", () => {
  it("upper-cases and strips non-alphanumerics from both halves", () => {
    expect(buildProductCodePrefix("HP", "Victus 15")).toBe("HP-VICTUS15");
  });

  it("truncates an overly long brand or product name", () => {
    expect(buildProductCodePrefix("A Very Long Brand Name Indeed", "Product")).toBe(
      "AVERYLONGB-PRODUCT",
    );
  });

  it("falls back to a placeholder when a name has no alphanumeric characters at all", () => {
    expect(buildProductCodePrefix("!!!", "???")).toBe("BRAND-MODEL");
  });
});
