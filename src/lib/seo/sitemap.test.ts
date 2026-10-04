import { describe, expect, it } from "vitest";
import { SITE_URL } from "./site";
import {
  buildSitemapIndexXml,
  FIXED_SITEMAP_SHARD_COUNT,
  parseSitemapShardId,
  sitemapShardIds,
  productSitemapChunk,
  productSitemapChunkCount,
  PRODUCTS_PER_SITEMAP,
  sitemapRowsToEntries,
  toSitemapUrlEntries,
} from "./sitemap";

describe("toSitemapUrlEntries", () => {
  it("returns only the en entry when hasNe is false", () => {
    const entries = toSitemapUrlEntries("/p/hp-victus-15", new Date("2026-01-01"), false);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.url).toBe(`${SITE_URL}/p/hp-victus-15`);
  });

  it("returns both en and ne entries when hasNe is true", () => {
    const entries = toSitemapUrlEntries("/", new Date("2026-01-01"), true);
    expect(entries).toHaveLength(2);
    expect(entries[0]!.url).toBe(`${SITE_URL}/`);
    expect(entries[1]!.url).toBe(`${SITE_URL}/ne`);
  });

  it("carries lastModified through unchanged", () => {
    const date = new Date("2026-03-15T00:00:00Z");
    const entries = toSitemapUrlEntries("/faq", date, false);
    expect(entries[0]!.lastModified).toBe(date);
  });
});

describe("sitemapRowsToEntries", () => {
  it("maps each row through toPathname", () => {
    const entries = sitemapRowsToEntries(
      [
        { slug: "laptops", updatedAt: new Date("2026-01-01") },
        { slug: "desktops", updatedAt: new Date("2026-01-02") },
      ],
      (slug) => `/c/${slug}`,
    );
    expect(entries.map((e) => e.url)).toEqual([`${SITE_URL}/c/laptops`, `${SITE_URL}/c/desktops`]);
  });

  it("returns an empty array for an empty input", () => {
    expect(sitemapRowsToEntries([], (slug) => `/p/${slug}`)).toEqual([]);
  });
});

describe("productSitemapChunkCount", () => {
  it("returns 1 for an empty catalogue (never zero shards)", () => {
    expect(productSitemapChunkCount(0)).toBe(1);
  });

  it("returns 1 when under the per-file cap", () => {
    expect(productSitemapChunkCount(150)).toBe(1);
  });

  it("returns exactly 1 at precisely the cap", () => {
    expect(productSitemapChunkCount(PRODUCTS_PER_SITEMAP)).toBe(1);
  });

  it("returns 2 for one product over the cap", () => {
    expect(productSitemapChunkCount(PRODUCTS_PER_SITEMAP + 1)).toBe(2);
  });

  it("returns the correct count for a large catalogue", () => {
    expect(productSitemapChunkCount(PRODUCTS_PER_SITEMAP * 3 + 500)).toBe(4);
  });
});

describe("productSitemapChunk", () => {
  it("slices the correct 0-based chunk", () => {
    const products = Array.from({ length: 25000 }, (_, i) => i);
    expect(productSitemapChunk(products, 0)).toHaveLength(PRODUCTS_PER_SITEMAP);
    expect(productSitemapChunk(products, 0)[0]).toBe(0);
    expect(productSitemapChunk(products, 2)).toHaveLength(5000);
    expect(productSitemapChunk(products, 2)[0]).toBe(PRODUCTS_PER_SITEMAP * 2);
  });

  it("returns an empty slice past the end", () => {
    const products = Array.from({ length: 5 }, (_, i) => i);
    expect(productSitemapChunk(products, 3)).toEqual([]);
  });
});

describe("parseSitemapShardId", () => {
  it("accepts the string segment Next.js actually passes", () => {
    expect(parseSitemapShardId("0")).toBe(0);
    expect(parseSitemapShardId("6")).toBe(6);
    expect(parseSitemapShardId("12")).toBe(12);
  });

  it("still accepts a number", () => {
    expect(parseSitemapShardId(3)).toBe(3);
  });

  it("rejects anything that is not a non-negative integer", () => {
    for (const bad of [undefined, null, "", "-1", "1.5", "abc", "0.xml", -1, 1.5, NaN]) {
      expect(parseSitemapShardId(bad)).toBeNull();
    }
  });
});

describe("sitemapShardIds", () => {
  it("lists the six fixed shards plus at least one product shard", () => {
    expect(sitemapShardIds(0)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("adds a product shard per chunk", () => {
    const ids = sitemapShardIds(PRODUCTS_PER_SITEMAP * 2 + 1);
    expect(ids).toHaveLength(FIXED_SITEMAP_SHARD_COUNT + 3);
    expect(ids.at(-1)).toBe(FIXED_SITEMAP_SHARD_COUNT + 2);
  });
});

describe("buildSitemapIndexXml", () => {
  const when = new Date("2026-10-04T00:00:00.000Z");

  it("lists every shard as an absolute URL", () => {
    const xml = buildSitemapIndexXml("https://example.com/", [0, 1], when);
    expect(xml).toContain('<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("<loc>https://example.com/sitemap/0.xml</loc>");
    expect(xml).toContain("<loc>https://example.com/sitemap/1.xml</loc>");
    expect(xml).toContain("<lastmod>2026-10-04T00:00:00.000Z</lastmod>");
    expect(xml).not.toContain("example.com//sitemap");
  });

  it("escapes XML-special characters in the origin", () => {
    const xml = buildSitemapIndexXml("https://example.com/?a=1&b=2", [0], when);
    expect(xml).toContain("&amp;");
    expect(xml).not.toMatch(/&b=/);
  });
});
