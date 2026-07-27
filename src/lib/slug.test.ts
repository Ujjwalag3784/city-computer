import { describe, expect, it } from "vitest";
import {
  isReservedSlug,
  isValidSlugFormat,
  slugify,
  transliterateDevanagari,
  uniqueSlug,
} from "./slug";

describe("transliterateDevanagari", () => {
  it("transliterates a simple Devanagari word", () => {
    expect(transliterateDevanagari("कम्प्युटर")).toBe("kmpyutr");
  });

  it("leaves Latin text unchanged", () => {
    expect(transliterateDevanagari("Laptop")).toBe("Laptop");
  });
});

describe("slugify", () => {
  it("slugifies a simple English product name", () => {
    expect(slugify("HP Victus 15 Gaming Laptop")).toBe("hp-victus-15-gaming-laptop");
  });

  it("collapses punctuation and multiple spaces into single hyphens", () => {
    expect(slugify("MSI Optix MAG241C 24″ Curved FHD Gaming Monitor")).toBe(
      "msi-optix-mag241c-24-curved-fhd-gaming-monitor",
    );
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--Hello World--")).toBe("hello-world");
  });

  it("transliterates Devanagari input before slugifying", () => {
    const result = slugify("ल्यापटप");
    expect(result).toMatch(/^[a-z0-9-]+$/);
    expect(result.length).toBeGreaterThan(0);
  });

  it("truncates long names at a word boundary within the max length", () => {
    const longName =
      "Acer Aspire lite 14 13th Gen Intel Core i3 N355 Processor 8GB LPDDR5 RAM 256GB 14 inch FHD Intel UHD Graphics One Year Warranty Extended";
    const result = slugify(longName, { maxLength: 60 });
    expect(result.length).toBeLessThanOrEqual(60);
    expect(result.endsWith("-")).toBe(false);
  });

  it("respects a custom maxLength", () => {
    const result = slugify("one two three four five six seven eight", { maxLength: 15 });
    expect(result.length).toBeLessThanOrEqual(15);
  });
});

describe("isReservedSlug", () => {
  it("flags top-level route names as reserved", () => {
    expect(isReservedSlug("admin")).toBe(true);
    expect(isReservedSlug("checkout")).toBe(true);
    expect(isReservedSlug("ADMIN")).toBe(true);
  });

  it("does not flag an ordinary product slug", () => {
    expect(isReservedSlug("hp-victus-15")).toBe(false);
  });
});

describe("isValidSlugFormat", () => {
  it("accepts a well-formed slug", () => {
    expect(isValidSlugFormat("hp-victus-15-gaming-laptop")).toBe(true);
  });

  it("rejects uppercase, spaces, and leading/trailing hyphens", () => {
    expect(isValidSlugFormat("HP-Victus")).toBe(false);
    expect(isValidSlugFormat("hp victus")).toBe(false);
    expect(isValidSlugFormat("-hp-victus")).toBe(false);
    expect(isValidSlugFormat("hp-victus-")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(isValidSlugFormat("")).toBe(false);
  });

  it("rejects a slug longer than 80 characters", () => {
    expect(isValidSlugFormat("a".repeat(81))).toBe(false);
  });
});

describe("uniqueSlug", () => {
  it("returns the base slug when it is not taken", () => {
    expect(uniqueSlug("macbook-air-m4", new Set(["other-slug"]))).toBe("macbook-air-m4");
  });

  it("appends -2 when the base slug is taken", () => {
    expect(uniqueSlug("macbook-air-m4", new Set(["macbook-air-m4"]))).toBe("macbook-air-m4-2");
  });

  it("finds the next free suffix when several variants are taken", () => {
    const taken = new Set(["macbook-air-m4", "macbook-air-m4-2", "macbook-air-m4-3"]);
    expect(uniqueSlug("macbook-air-m4", taken)).toBe("macbook-air-m4-4");
  });

  it("accepts a plain array as well as a Set", () => {
    expect(uniqueSlug("x", ["x"])).toBe("x-2");
  });
});
