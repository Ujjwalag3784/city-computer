/**
 * docs/11-SEO-STRATEGY.md §7.5's PDP OG image: "Product photo on
 * `--background`, with `displayTitle`, brand, price in रु, and the
 * availability badge." The real product photo is composited via `next/
 * og`'s `<img>` support (a plain `<img src>` inside the `ImageResponse`
 * tree — the edge renderer fetches it directly, no `next/image`
 * involved, so the empty `images.remotePatterns` config doesn't block
 * this the way it would a normal page `<Image>`).
 */
import { ImageResponse } from "next/og";
import { formatNPR } from "@/lib/money";
import { getProductBySlug } from "@/server/services/catalog/product";
import { OG_COLORS, OG_CONTENT_TYPE, OG_IMAGE_SIZE } from "@/lib/seo/og-image-theme";
import { toPrismaLocale } from "../../_lib/catalog-view";

export const runtime = "edge";
export const alt = "Product — City Computer Systems";
export const size = OG_IMAGE_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ locale: string; productSlug: string }>;
}

export default async function Image({ params }: Props) {
  const { locale, productSlug } = await params;

  let title = "Product";
  let brand = "";
  let priceLabel = "";
  let imageUrl: string | null = null;
  let availabilityLabel = "";

  try {
    const product = await getProductBySlug(productSlug, toPrismaLocale(locale));
    title = product.displayTitle;
    brand = product.brand.name;
    imageUrl = product.media[0]?.url ?? null;
    const variant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
    if (variant) {
      priceLabel = formatNPR(variant.pricePaisa);
      availabilityLabel = variant.availableQuantity > 0 ? "In stock" : "Out of stock";
    }
  } catch {
    // Fall through with the generic defaults rather than 500ing an OG image request.
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: OG_COLORS.background,
        }}
      >
        <div
          style={{
            width: "45%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: OG_COLORS.surface,
          }}
        >
          {imageUrl ? (
            // next/og's ImageResponse renderer requires a plain <img>, not next/image.
            <img src={imageUrl} width={420} height={420} style={{ objectFit: "contain" }} alt="" />
          ) : (
            <div style={{ fontSize: 28, color: OG_COLORS.onSurfaceVariant, display: "flex" }}>
              City Computer Systems
            </div>
          )}
        </div>
        <div
          style={{
            width: "55%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            gap: 16,
            padding: 64,
          }}
        >
          <div style={{ fontSize: 24, color: OG_COLORS.primary, display: "flex" }}>{brand}</div>
          <div
            style={{ fontSize: 48, fontWeight: 700, color: OG_COLORS.onSurface, display: "flex" }}
          >
            {title}
          </div>
          {priceLabel && (
            <div style={{ fontSize: 40, color: OG_COLORS.onSurface, display: "flex" }}>
              {priceLabel}
            </div>
          )}
          {availabilityLabel && (
            <div style={{ fontSize: 24, color: OG_COLORS.onSurfaceVariant, display: "flex" }}>
              {availabilityLabel}
            </div>
          )}
        </div>
      </div>
    ),
    { ...OG_IMAGE_SIZE },
  );
}
