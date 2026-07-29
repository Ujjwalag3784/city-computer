/**
 * docs/11-SEO-STRATEGY.md §4.11 — a saved/shared PC build (`/build/
 * [shortId]`) modelled as a `Product` bundle with `AggregateOffer`, not
 * `WebApplication` (that's `/build`'s own configurator page, see
 * `web-application.ts`).
 *
 * Robots posture (exact quote): "Default posture: `noindex,follow` —
 * thousands of near-duplicate configurations would be index bloat and
 * thin content. Markup is still emitted for social/AI unfurling and for
 * the curated exception." This builder has no opinion on robots at all —
 * the route (`/build/[shortId]/page.tsx`) already hardcodes
 * `noindex,follow` in its own `metadata` export; this builder's only job
 * is producing correct markup regardless of whether the page is indexed,
 * exactly as the doc describes ("still emitted").
 */
import { absoluteUrl } from "../site";
import { toSchemaPrice } from "./money";
import type { JsonLdNode } from "./types";

export interface BuildProductPartRef {
  /** e.g. the part's own PDP slug, if it's separately purchasable as a real Product. */
  productSlug?: string | null;
}

export interface BuildProductJsonLdInput {
  shortId: string;
  name: string;
  description: string;
  imageUrl: string;
  /** Total price of every part currently in the build, in paisa. */
  totalPricePaisa: number;
  availability: "InStock" | "OutOfStock" | "PreOrder";
  parts: BuildProductPartRef[];
}

export function buildBuildProductJsonLd(input: BuildProductJsonLdInput): JsonLdNode {
  const pageUrl = absoluteUrl(`/build/${input.shortId}`, "en");
  const price = toSchemaPrice(input.totalPricePaisa);
  const relatedProducts = input.parts
    .filter((part): part is { productSlug: string } => Boolean(part.productSlug))
    .map((part) => ({
      "@type": "Product",
      "@id": `${absoluteUrl(`/p/${part.productSlug}`, "en")}#product`,
    }));

  return {
    "@type": "Product",
    "@id": `${pageUrl}#build`,
    name: input.name,
    description: input.description,
    image: input.imageUrl,
    brand: { "@id": `${absoluteUrl("/", "en")}#organization` },
    category: "Custom PC Builds",
    ...(relatedProducts.length > 0 ? { isRelatedTo: relatedProducts } : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "NPR",
      lowPrice: price,
      highPrice: price,
      offerCount: 1,
      availability: `https://schema.org/${input.availability}`,
      seller: { "@id": `${absoluteUrl("/", "en")}#organization` },
    },
  };
}
