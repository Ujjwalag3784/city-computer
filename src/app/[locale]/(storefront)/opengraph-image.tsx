/**
 * docs/11-SEO-STRATEGY.md §7.5 — the default/homepage OG image ("Logo
 * lockup on `--background`"). Also the fallback social card for every
 * storefront route under `(storefront)` that doesn't define its own more
 * specific `opengraph-image.tsx` (Next resolves the nearest one up the
 * segment tree) — e.g. `/faq`, `/stores`, `/service`, `/emi-calculator`,
 * `/build/new`, matching the doc's own §7.5 table split between "dynamic"
 * and "static branded" OG routes.
 */
import { ImageResponse } from "next/og";
import { OG_COLORS, OG_CONTENT_TYPE, OG_IMAGE_SIZE } from "@/lib/seo/og-image-theme";

export const runtime = "edge";
export const alt = "City Computer Systems";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 24,
          backgroundColor: OG_COLORS.background,
        }}
      >
        <div
          style={{
            fontSize: 72,
            fontWeight: 700,
            color: OG_COLORS.onSurface,
            display: "flex",
          }}
        >
          City Computer Systems
        </div>
        <div style={{ fontSize: 32, color: OG_COLORS.primary, display: "flex" }}>
          Laptops, PCs, Components & Repairs in Kathmandu
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}
