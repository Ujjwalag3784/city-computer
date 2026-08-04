/**
 * The category Open Graph image — docs/11-SEO-STRATEGY.md §7.5's "Category
 * name, product count, four product thumbnails in a grid."
 *
 * WHY THIS IS A ROUTE HANDLER AND NOT AN `opengraph-image.tsx` FILE:
 * it used to be `[locale]/(storefront)/c/[...categorySlug]/opengraph-image.tsx`,
 * which Next.js's own route validation rejects outright — a metadata image
 * file inside a catch-all segment produces the route
 * `/c/[...categorySlug]/opengraph-image`, and a catch-all segment cannot be
 * followed by anything. Next.js failed the whole route tree with
 * "Catch-all must be the last part of the URL," which took down `next dev`
 * at startup and would have taken down `next build` too. Nothing else in the
 * repo's checks could see it: it is not a type error, not a lint error, and
 * no test renders the route tree.
 *
 * The fix keeps the feature and moves the URL: the category page's
 * `generateMetadata` now points `openGraph.images` at
 * `/api/og/category?path=...&locale=...` explicitly, instead of relying on
 * the file convention to infer it. Same renderer, same live data, same size —
 * only the address changed. The three OG image files on non-catch-all routes
 * (homepage, `/p/[productSlug]`, `/blog/[slug]`) are all legal and untouched.
 *
 * `/api/*` is outside `middleware.ts`'s matcher, so this needs no session or
 * locale handling.
 *
 * Product thumbnails remain a flagged, deliberate scope cut, unchanged from
 * the original file — pulling and laying out four real CDN images inside the
 * edge `ImageResponse` renderer is real, separate work, and
 * `next.config.ts`'s `images.remotePatterns` is still empty (no CDN domain
 * finalised yet — see PROGRESS.md). Name + live product count is real, live
 * data, not a mock.
 */
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { getCategoryByPath } from "@/server/services/catalog/category";
import { listProducts } from "@/server/services/catalog/product";
import { OG_COLORS, OG_IMAGE_SIZE } from "@/lib/seo/og-image-theme";

// Deliberately left on the default Node.js runtime. `edge` (which the file
// this replaced declared) cannot resolve `pg`, which this route reaches through
// the catalog service layer -> `@/server/db` -> `@prisma/adapter-pg`; on the
// edge runtime every request here 500s with "Can't resolve 'pg-native'".
// `next/og`'s `ImageResponse` renders perfectly well on Node.

/** A category path is at most a handful of slugs; anything longer is not a real path and is not worth a database round trip. */
const MAX_CATEGORY_PATH_LENGTH = 256;

export async function GET(request: NextRequest) {
  const rawPath = request.nextUrl.searchParams.get("path")?.slice(0, MAX_CATEGORY_PATH_LENGTH) ?? "";
  const locale = request.nextUrl.searchParams.get("locale") === "ne" ? "NE" : "EN";

  let name = rawPath.split("/").filter(Boolean).pop() ?? "Category";
  let count = 0;
  try {
    const category = await getCategoryByPath(rawPath, locale);
    name = category.name;
    const result = await listProducts({ categoryPath: rawPath, perPage: 1 }, locale);
    count = result.pagination.total;
  } catch {
    // Fall through with the slug-derived name and a zero count rather than
    // 500ing an OG image request — a social crawler asking for a card should
    // never be the thing that surfaces an error page.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          backgroundColor: OG_COLORS.background,
        }}
      >
        <div style={{ fontSize: 28, color: OG_COLORS.primary, display: "flex" }}>
          City Computer Systems
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{ fontSize: 64, fontWeight: 700, color: OG_COLORS.onSurface, display: "flex" }}
          >
            {name}
          </div>
          <div style={{ fontSize: 32, color: OG_COLORS.onSurfaceVariant, display: "flex" }}>
            {count > 0 ? `${count} product${count === 1 ? "" : "s"} available` : "Shop now"}
          </div>
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}
