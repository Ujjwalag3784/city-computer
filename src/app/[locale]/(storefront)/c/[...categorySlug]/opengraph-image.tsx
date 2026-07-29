/**
 * docs/11-SEO-STRATEGY.md §7.5's category OG image: "Category name,
 * product count, four product thumbnails in a grid." Product thumbnails
 * are a flagged, deliberate scope cut — pulling and laying out four real
 * CDN images inside the edge `ImageResponse` renderer is real, separate
 * work (remote image fetch + grid composition), and `next.config.ts`'s
 * `images.remotePatterns` is still empty (no CDN domain finalised yet —
 * see PROGRESS.md). Name + live product count is real, live data, not a
 * mock.
 */
import { ImageResponse } from "next/og";
import { getCategoryByPath } from "@/server/services/catalog/category";
import { listProducts } from "@/server/services/catalog/product";
import { OG_COLORS, OG_CONTENT_TYPE, OG_IMAGE_SIZE } from "@/lib/seo/og-image-theme";
import { toPrismaLocale } from "../../_lib/catalog-view";

export const runtime = "edge";
export const alt = "Category — City Computer Systems";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ locale: string; categorySlug: string[] }>;
}

export default async function Image({ params }: Props) {
  const { locale, categorySlug } = await params;
  const categoryPath = categorySlug.join("/");

  let name = categoryPath.split("/").pop() ?? "Category";
  let count = 0;
  try {
    const prismaLocale = toPrismaLocale(locale);
    const category = await getCategoryByPath(categoryPath, prismaLocale);
    name = category.name;
    const result = await listProducts({ categoryPath, perPage: 1 }, prismaLocale);
    count = result.pagination.total;
  } catch {
    // Fall through with the slug-derived name and a zero count rather than 500ing an OG image request.
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
