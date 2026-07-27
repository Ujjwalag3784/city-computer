import { describe, expect, it } from "vitest";
import {
  formatNepalPhoneForDisplay,
  isNepalProvince,
  isValidNepalPhone,
  isValidWard,
  lastFourDigits,
  normalizeNepalPhone,
} from "./nepal";

describe("isNepalProvince", () => {
  it("accepts all seven provinces", () => {
    expect(isNepalProvince("BAGMATI")).toBe(true);
    expect(isNepalProvince("SUDURPASHCHIM")).toBe(true);
  });

  it("rejects an unknown province", () => {
    expect(isNepalProvince("ATLANTIS")).toBe(false);
  });
});

describe("isValidWard", () => {
  it("accepts wards 1 through 35", () => {
    expect(isValidWard(1)).toBe(true);
    expect(isValidWard(35)).toBe(true);
    expect(isValidWard(12)).toBe(true);
  });

  it("rejects out-of-range or non-integer wards", () => {
    expect(isValidWard(0)).toBe(false);
    expect(isValidWard(36)).toBe(false);
    expect(isValidWard(4.5)).toBe(false);
  });
});

describe("normalizeNepalPhone", () => {
  it("normalises a bare 10-digit number", () => {
    expect(normalizeNepalPhone("9841234567")).toBe("+9779841234567");
  });

  it("normalises with a +977 prefix and space", () => {
    expect(normalizeNepalPhone("+977 9841234567")).toBe("+9779841234567");
  });

  it("normalises with a 977- prefix", () => {
    expect(normalizeNepalPhone("977-9841234567")).toBe("+9779841234567");
  });

  it("normalises with internal spacing", () => {
    expect(normalizeNepalPhone("+977 98 4123 4567")).toBe("+9779841234567");
  });

  it("accepts 96/97/98-prefixed mobile ranges", () => {
    expect(normalizeNepalPhone("9612345678")).toBe("+9779612345678");
    expect(normalizeNepalPhone("9712345678")).toBe("+9779712345678");
  });

  it("rejects a landline-style or too-short number", () => {
    expect(normalizeNepalPhone("014123456")).toBeNull();
    expect(normalizeNepalPhone("98412345")).toBeNull();
  });

  it("rejects non-Nepali numbers", () => {
    expect(normalizeNepalPhone("+14155552671")).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(normalizeNepalPhone("not a phone number")).toBeNull();
  });
});

describe("isValidNepalPhone", () => {
  it("mirrors normalizeNepalPhone's judgement", () => {
    expect(isValidNepalPhone("9841234567")).toBe(true);
    expect(isValidNepalPhone("12345")).toBe(false);
  });
});

describe("formatNepalPhoneForDisplay", () => {
  it("formats a normalised number for display", () => {
    expect(formatNepalPhoneForDisplay("+9779841234567")).toBe("+977 98-4123-4567");
  });

  it("formats a raw local number for display", () => {
    expect(formatNepalPhoneForDisplay("9841234567")).toBe("+977 98-4123-4567");
  });

  it("returns the input unchanged if it cannot be normalised", () => {
    expect(formatNepalPhoneForDisplay("garbage")).toBe("garbage");
  });
});

describe("lastFourDigits", () => {
  it("returns the last 4 digits of a valid number", () => {
    expect(lastFourDigits("+9779841234567")).toBe("4567");
    expect(lastFourDigits("9841234567")).toBe("4567");
  });

  it("returns null for an invalid number", () => {
    expect(lastFourDigits("garbage")).toBeNull();
  });
});
