import { describe, expect, it } from "vitest";
import {
  buildCanonical,
  buildHreflangAlternates,
  buildMetaTitle,
  buildOpenGraph,
  clampDescription,
  cleanTemplateString,
  paginatedDescription,
  paginatedTitle,
  robotsForTranslationState,
  truncateAtWordBoundary,
} from "./metadata";
import { SITE_URL } from "./site";

describe("cleanTemplateString", () => {
  it("collapses repeated whitespace", () => {
    expect(cleanTemplateString("HP   Victus  15")).toBe("HP Victus 15");
  });

  it("strips a leading/trailing pipe left by an empty template variable", () => {
    expect(cleanTemplateString("| HP Victus 15 |")).toBe("HP Victus 15");
    expect(cleanTemplateString("HP Victus 15 | | City Computer")).toBe(
      "HP Victus 15 | City Computer",
    );
  });
});

describe("truncateAtWordBoundary", () => {
  it("returns the input unchanged when under the limit", () => {
    expect(truncateAtWordBoundary("HP Victus 15", 65)).toBe("HP Victus 15");
  });

  it("truncates at the last whole word, never mid-word", () => {
    const long = "HP Victus 15 Gaming Laptop Ryzen 5 RTX 3050 16GB 512GB SSD FHD 144Hz";
    const truncated = truncateAtWordBoundary(long, 30);
    expect(truncated.length).toBeLessThanOrEqual(30);
    expect(long.startsWith(truncated)).toBe(true);
    expect(long[truncated.length]).toBe(" ");
  });

  it("never appends an ellipsis", () => {
    const truncated = truncateAtWordBoundary("a".repeat(100), 10);
    expect(truncated).not.toContain("…");
  });
});

describe("buildMetaTitle / clampDescription", () => {
  it("keeps a title under the hard max", () => {
    const title = buildMetaTitle("a".repeat(100));
    expect(title.length).toBeLessThanOrEqual(65);
  });

  it("keeps a description under the hard max", () => {
    const description = clampDescription("a ".repeat(200));
    expect(description.length).toBeLessThanOrEqual(165);
  });
});

describe("buildCanonical", () => {
  it("builds a self-referencing absolute canonical with no query params by default", () => {
    expect(buildCanonical("/c/laptops", "en")).toBe(`${SITE_URL}/c/laptops`);
  });

  it("appends ?page=N only when page > 1", () => {
    expect(buildCanonical("/c/laptops", "en", { page: 1 })).toBe(`${SITE_URL}/c/laptops`);
    expect(buildCanonical("/c/laptops", "en", { page: 2 })).toBe(`${SITE_URL}/c/laptops?page=2`);
  });

  it("is locale-aware", () => {
    expect(buildCanonical("/c/laptops", "ne")).toBe(`${SITE_URL}/ne/c/laptops`);
  });
});

describe("buildHreflangAlternates", () => {
  it("always includes en and x-default pointing at the unprefixed URL", () => {
    const alternates = buildHreflangAlternates("/p/hp-victus-15", { ne: false });
    expect(alternates.en).toBe(`${SITE_URL}/p/hp-victus-15`);
    expect(alternates["x-default"]).toBe(`${SITE_URL}/p/hp-victus-15`);
  });

  it("omits ne entirely when no real translation exists (reciprocity)", () => {
    const alternates = buildHreflangAlternates("/p/hp-victus-15", { ne: false });
    expect(alternates.ne).toBeUndefined();
  });

  it("includes ne only when a real translation exists", () => {
    const alternates = buildHreflangAlternates("/p/hp-victus-15", { ne: true });
    expect(alternates.ne).toBe(`${SITE_URL}/ne/p/hp-victus-15`);
  });
});

describe("robotsForTranslationState", () => {
  it("uses the baseline for the default locale regardless of translation state", () => {
    expect(robotsForTranslationState("en", false)).toEqual({ index: true, follow: true });
  });

  it("noindexes a ne page with no real translation, even if the baseline is indexable", () => {
    expect(robotsForTranslationState("ne", false)).toEqual({ index: false, follow: true });
  });

  it("uses the baseline for a ne page that does have a real translation", () => {
    expect(robotsForTranslationState("ne", true)).toEqual({ index: true, follow: true });
  });

  it("respects a stricter caller-supplied baseline for a translated ne page", () => {
    expect(robotsForTranslationState("ne", true, { index: false, follow: false })).toEqual({
      index: false,
      follow: false,
    });
  });
});

describe("paginatedTitle / paginatedDescription", () => {
  it("leaves page 1 untouched", () => {
    expect(paginatedTitle("Gaming Laptops", 1)).toBe("Gaming Laptops");
    expect(paginatedDescription("Shop gaming laptops.", 1, 5)).toBe("Shop gaming laptops.");
  });

  it("appends a page suffix for page 2+", () => {
    expect(paginatedTitle("Gaming Laptops", 2)).toBe("Gaming Laptops — Page 2");
    expect(paginatedDescription("Shop gaming laptops.", 2, 5)).toBe(
      "Page 2 of 5. Shop gaming laptops.",
    );
  });
});

describe("buildOpenGraph", () => {
  it("defaults to type website, never article, unless explicitly overridden", () => {
    const og = buildOpenGraph({
      title: "ASUS TUF Gaming A15",
      url: `${SITE_URL}/p/asus-tuf-a15`,
      locale: "en",
    });
    expect((og as Record<string, unknown>).type).toBe("website");
  });

  it("maps locale ne to og:locale ne_NP", () => {
    const og = buildOpenGraph({
      title: "Post",
      url: `${SITE_URL}/blog/post`,
      locale: "ne",
    });
    expect(og.locale).toBe("ne_NP");
  });

  it("allows article type only when explicitly requested (blog posts)", () => {
    const og = buildOpenGraph({
      title: "Buying guide",
      url: `${SITE_URL}/blog/best-laptops-2026`,
      locale: "en",
      type: "article",
    });
    expect((og as Record<string, unknown>).type).toBe("article");
  });
});
