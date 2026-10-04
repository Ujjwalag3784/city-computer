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

/** Shards 0-5 are fixed (static, categories, brands, posts, pages, branches); products start at 6. */
export const FIXED_SITEMAP_SHARD_COUNT = 6;

/** Every shard id `src/app/sitemap.ts` serves, for a catalogue of `productCount` indexable products. */
export function sitemapShardIds(productCount: number): number[] {
  const total = FIXED_SITEMAP_SHARD_COUNT + productSitemapChunkCount(productCount);
  return Array.from({ length: total }, (_, id) => id);
}

/**
 * Next.js hands a `generateSitemaps()` shard id to the sitemap function as
 * the URL segment string (`"0"`, from `/sitemap/0.xml`), not the number
 * `generateSitemaps()` returned. Comparing it with `case 0:` never matches,
 * which is how every shard on the live site came back as an empty
 * `<urlset>`. Returns `null` for anything that is not a non-negative integer.
 */
export function parseSitemapShardId(id: unknown): number | null {
  const n =
    typeof id === "number" ? id : typeof id === "string" && /^\d+$/.test(id) ? Number(id) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * The `/sitemap.xml` index. Next.js does NOT generate one when a sitemap uses
 * `generateSitemaps()` — it only serves `/sitemap/{id}.xml` — so `robots.txt`
 * was pointing crawlers at a 404. Served from `app/api/sitemap-index` via a
 * rewrite in `next.config.ts`.
 */
export function buildSitemapIndexXml(
  siteOrigin: string,
  shardIds: number[],
  lastModified: Date,
): string {
  const origin = siteOrigin.replace(/\/+$/, "");
  const lastmod = lastModified.toISOString();
  const entries = shardIds
    .map(
      (id) =>
        `  <sitemap>\n    <loc>${escapeXml(`${origin}/sitemap/${id}.xml`)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </sitemap>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</sitemapindex>\n`;
}
