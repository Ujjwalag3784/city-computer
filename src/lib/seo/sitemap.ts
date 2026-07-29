/**
 * Pure sitemap-shaping helpers behind `src/app/sitemap.ts` — kept
 * dependency-free (no `db`, no `server-only`) specifically so the
 * chunking math and URL-entry shaping are unit-testable without a
 * database connection, per this codebase's own "pure logic in `lib/`,
 * DB access in `server/services/`" convention.
 */
import { absoluteUrl } from "./site";

export interface SitemapSourceRow {
  slug: string;
  updatedAt: Date;
}

/** docs/11-STRATEGY §5.1: "50,000 URLs / 50MB hard limits; self-imposed cap is 10,000/file." */
export const PRODUCTS_PER_SITEMAP = 10000;

export type SitemapUrlEntry = { url: string; lastModified: Date };

/**
 * One or two `<url>` entries for `pathname` — `en` always, `ne` only when
 * `hasNe` is true. §5.1: "Both `en` and `ne` URLs listed as separate
 * `<url>` entries. Only real translated pages listed."
 */
export function toSitemapUrlEntries(
  pathname: string,
  updatedAt: Date,
  hasNe: boolean,
): SitemapUrlEntry[] {
  const entries: SitemapUrlEntry[] = [
    { url: absoluteUrl(pathname, "en"), lastModified: updatedAt },
  ];
  if (hasNe) {
    entries.push({ url: absoluteUrl(pathname, "ne"), lastModified: updatedAt });
  }
  return entries;
}

/** Maps a list of `{slug, updatedAt}` rows to sitemap entries via `toPathname`, with no `ne` alternate (every current entity call site has none — see `sitemap.ts`'s own doc comment). */
export function sitemapRowsToEntries(
  rows: SitemapSourceRow[],
  toPathname: (slug: string) => string,
): SitemapUrlEntry[] {
  return rows.flatMap((row) => toSitemapUrlEntries(toPathname(row.slug), row.updatedAt, false));
}

/** Number of `id`s a set of `totalCount` products needs, chunked at `PRODUCTS_PER_SITEMAP` — always at least 1, even for an empty catalogue, so `generateSitemaps()` never returns zero product shard ids. */
export function productSitemapChunkCount(totalCount: number): number {
  return Math.max(1, Math.ceil(totalCount / PRODUCTS_PER_SITEMAP));
}

/** The slice of `products` belonging to 0-based chunk `chunkIndex`. */
export function productSitemapChunk<T>(products: T[], chunkIndex: number): T[] {
  return products.slice(chunkIndex * PRODUCTS_PER_SITEMAP, (chunkIndex + 1) * PRODUCTS_PER_SITEMAP);
}
