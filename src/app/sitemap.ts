/**
 * docs/11-SEO-STRATEGY.md §5.1-§5.3 — the sitemap index + child sitemaps.
 * Uses Next.js 15's `generateSitemaps()` multi-file convention: Next
 * itself serves `/sitemap.xml` as the index listing every `/sitemap/
 * {id}.xml` this file produces — that IS this codebase's sitemap index,
 * not a hand-rolled XML file, matching the doc's "a sitemap index is
 * required" requirement without reinventing what the framework already
 * does correctly.
 *
 * Shard layout (fixed ids 0-5, then one id per product chunk):
 *   0 — static core pages (home, /faq, /stores, /service,
 *       /emi-calculator, /build/new)
 *   1 — categories
 *   2 — brands
 *   3 — blog posts
 *   4 — CMS pages
 *   5 — store branches
 *   6+ — products, chunked by `productSitemapChunkCount`/
 *        `productSitemapChunk` (`lib/seo/sitemap.ts`) at 10,000/file
 *        (docs/11 §5.1's own self-imposed cap) — far above this
 *        catalogue's real size today, but the chunking logic is real and
 *        exercised by its own unit test, not just correct by accident of
 *        a small catalogue.
 *
 * Every entity function in `sitemap-data.ts` already filters to
 * indexable-only rows (§5.2/§5.3) — nothing here re-implements that
 * filter. `priority`/`changefreq` are deliberately omitted everywhere:
 * "Google ignores them; they are noise" (§5.1, verbatim).
 */
import type { MetadataRoute } from "next";
import {
  productSitemapChunk,
  productSitemapChunkCount,
  sitemapRowsToEntries,
  toSitemapUrlEntries,
} from "@/lib/seo/sitemap";
import {
  listSitemapBrands,
  listSitemapBranches,
  listSitemapCategories,
  listSitemapPages,
  listSitemapPosts,
  listSitemapProducts,
} from "@/server/services/seo/sitemap-data";

export const revalidate = 3600;

const STATIC_CORE_PATHS = [
  "/",
  "/faq",
  "/stores",
  "/service",
  "/emi-calculator",
  "/build/new",
] as const;

const FIXED_SHARD_COUNT = 6; // ids 0-5

export async function generateSitemaps(): Promise<{ id: number }[]> {
  const productCount = await listSitemapProducts().then((rows) => rows.length);
  const productChunkCount = productSitemapChunkCount(productCount);
  return Array.from({ length: FIXED_SHARD_COUNT + productChunkCount }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: number }): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  switch (id) {
    case 0:
      // Only `/` currently claims a real `ne` translation — see the
      // storefront route files' own `HAS_NE_TRANSLATION` comments.
      return STATIC_CORE_PATHS.flatMap((pathname) =>
        toSitemapUrlEntries(pathname, now, pathname === "/"),
      );
    case 1:
      return sitemapRowsToEntries(await listSitemapCategories(), (slug) => `/c/${slug}`);
    case 2:
      return sitemapRowsToEntries(await listSitemapBrands(), (slug) => `/b/${slug}`);
    case 3:
      return sitemapRowsToEntries(await listSitemapPosts(), (slug) => `/blog/${slug}`);
    case 4:
      return sitemapRowsToEntries(await listSitemapPages(), (slug) => `/pages/${slug}`);
    case 5:
      return sitemapRowsToEntries(await listSitemapBranches(), (slug) => `/stores/${slug}`);
    default: {
      const chunkIndex = id - FIXED_SHARD_COUNT;
      const products = await listSitemapProducts();
      const chunk = productSitemapChunk(products, chunkIndex);
      return sitemapRowsToEntries(chunk, (slug) => `/p/${slug}`);
    }
  }
}
