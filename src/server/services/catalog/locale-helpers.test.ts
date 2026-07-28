import { describe, expect, it } from "vitest";
import { Locale } from "@/generated/prisma/client";
import { buildPaginationMeta, resolveTranslated } from "./locale-helpers";

interface FakeTranslation {
  locale: Locale;
  name: string;
  description: string | null;
}

const EN: FakeTranslation = {
  locale: Locale.EN,
  name: "Gaming Laptops",
  description: "English copy",
};
const NE: FakeTranslation = { locale: Locale.NE, name: "गेमिंग ल्यापटप", description: null };

describe("resolveTranslated", () => {
  it("returns the exact-locale translation when present", () => {
    expect(resolveTranslated([EN, NE], Locale.NE, "name", "fallback-slug")).toBe(NE.name);
  });

  it("falls back to English when the requested locale has no row at all", () => {
    expect(resolveTranslated([EN], Locale.NE, "name", "fallback-slug")).toBe(EN.name);
  });

  it("falls back to English when the requested locale's field is null", () => {
    expect(resolveTranslated([EN, NE], Locale.NE, "description", "fallback")).toBe("English copy");
  });

  it("falls back to the caller-supplied literal when no translation exists at all", () => {
    expect(resolveTranslated([] as FakeTranslation[], Locale.EN, "name", "fallback-slug")).toBe(
      "fallback-slug",
    );
  });

  it("does not re-check English when the requested locale already is English", () => {
    // Only an NE row exists; asking for EN should not silently return the NE name.
    expect(resolveTranslated([NE], Locale.EN, "name", "fallback-slug")).toBe("fallback-slug");
  });
});

describe("buildPaginationMeta", () => {
  it("computes totalPages and hasNext for a partial last page", () => {
    const meta = buildPaginationMeta(1, 24, 50);
    expect(meta).toEqual({
      page: 1,
      perPage: 24,
      total: 50,
      totalPages: 3,
      hasNext: true,
      nextCursor: null,
    });
  });

  it("reports hasNext: false on the last page", () => {
    const meta = buildPaginationMeta(3, 24, 50);
    expect(meta.hasNext).toBe(false);
    expect(meta.totalPages).toBe(3);
  });

  it("treats zero results as a single (empty) page, not zero pages", () => {
    const meta = buildPaginationMeta(1, 24, 0);
    expect(meta.totalPages).toBe(1);
    expect(meta.hasNext).toBe(false);
  });

  it("handles an exact multiple of perPage without an extra empty page", () => {
    const meta = buildPaginationMeta(2, 25, 50);
    expect(meta.totalPages).toBe(2);
    expect(meta.hasNext).toBe(false);
  });
});
