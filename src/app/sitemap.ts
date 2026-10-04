/**
 * docs/11-SEO-STRATEGY.md §5.1-§5.3 — the sitemap index + child sitemaps.
 * Uses Next.js 15's `generateSitemaps()` multi-file convention, which serves
 * each shard at `/sitemap/{id}.xml`. CORRECTED: Next does NOT also serve a
 * `/sitemap.xml` index for it (an earlier version of this comment said it
 * did, and the live `/sitemap.xml` was a 404). The index is
 * `app/api/sitemap-index/route.ts`, rewritten to `/sitemap.xml` in
 * `next.config.ts`.
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
  FIXED_SITEMAP_SHARD_COUNT,
  parseSitemapShardId,
  productSitemapChunk,
  sitemapRowsToEntries,
  sitemapShardIds,
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

export async function generateSitemaps(): Promise<{ id: number }[]> {
  const productCount = await listSitemapProducts().then((rows) => rows.length);
  return sitemapShardIds(productCount).map((id) => ({ id }));
}

/**
 * `id` arrives as the URL segment string ("0" from `/sitemap/0.xml`), not a
 * number, despite `generateSitemaps()` returning numbers — see
 * `parseSitemapShardId`. Typed `unknown` so nothing compares it raw again.
 */
export default async function sitemap({
  id: rawId,
}: {
  id: unknown;
}): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const id = parseSitemapShardId(rawId);
  if (id === null) return [];

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
      const chunkIndex = id - FIXED_SITEMAP_SHARD_COUNT;
      const products = await listSitemapProducts();
      const chunk = productSitemapChunk(products, chunkIndex);
      return sitemapRowsToEntries(chunk, (slug) => `/p/${slug}`);
    }
  }
}
