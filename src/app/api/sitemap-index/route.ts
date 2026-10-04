import { buildSitemapIndexXml, sitemapShardIds } from "@/lib/seo/sitemap";
import { SITE_URL } from "@/lib/seo/site";
import { listSitemapProducts } from "@/server/services/seo/sitemap-data";

/**
 * `/sitemap.xml` (rewritten here in `next.config.ts`) — the sitemap index.
 *
 * Next.js serves each `generateSitemaps()` shard at `/sitemap/{id}.xml` but
 * does not generate the index that lists them, so `/sitemap.xml` — the URL
 * `robots.ts` advertises — was a 404 on the live site.
 */
export const revalidate = 3600;

export async function GET() {
  const productCount = await listSitemapProducts().then((rows) => rows.length);
  const xml = buildSitemapIndexXml(SITE_URL, sitemapShardIds(productCount), new Date());
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
