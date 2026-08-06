"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * ProductImage — every product photo on the storefront goes through here so
 * a missing or broken source degrades into a deliberate placeholder instead
 * of the browser's broken-image glyph.
 *
 * WHY. The first production deploy's logs were full of
 * `GET /images/placeholder/<slug>-gallery-01-<hash>.avif 404` and
 * `GET /_next/image 404` — one cause, not two: `prisma/seed/catalog.ts`
 * minted a `Media` row per demo product pointing at a per-product `.avif`
 * filename that was never generated (there is no `public/` directory in this
 * repo at all), and `next/image`'s optimiser propagates the upstream status,
 * so the local 404 came back out of `/_next/image` as a 404. Every product
 * on the demo showed a broken image. The seed now points at
 * `public/images/placeholder/product.svg`, which exists — and this component
 * is the belt to that braces, covering the cases a committed asset cannot:
 * a real S3/CDN object that has since been deleted, a typo'd URL, a product
 * whose media row is missing entirely, and any future seed drift.
 *
 * EVERY product/part photo goes through here, and that is a hard requirement
 * rather than a tidiness preference: because the committed placeholder is an
 * SVG, any surface still calling `next/image` directly would hand the
 * optimiser an SVG source and get HTTP 400 back (`dangerouslyAllowSVG` is
 * deliberately off — see `next.config.ts`), which is the same broken image
 * with a different status code. The callers are `commerce/{product-card,
 * gallery,thumb-strip,cart-line-item,compare-table}` and `builder/{part-row,
 * builder-slot-card}`. The last four were still on a bare `<Image>` when the
 * placeholder first landed, which would have 400'd every PDP thumbnail and
 * every builder part row on the seeded catalogue.
 *
 * `"use client"`: `onError` is a DOM event handler bound to this component's
 * own `<Image>`, and a handler can only be attached by the component that
 * owns it. Every prop crossing in is serialisable, so `ProductCard` stays
 * renderable from a Server Component — which is the whole point of the
 * boundary fix this landed alongside (see `product-card.tsx`'s header).
 *
 * `unoptimized` is set for the placeholder and for `data:` sources rather
 * than globally: `next/image` refuses to run an SVG through its optimiser
 * unless `next.config.ts` sets `dangerouslyAllowSVG`, which would let *any*
 * future remote pattern serve scriptable SVGs through the optimiser and is
 * not worth enabling for one placeholder. Real raster photos still get the
 * full AVIF/WebP treatment.
 */
export const PRODUCT_IMAGE_PLACEHOLDER = "/images/placeholder/product.svg";

export interface ProductImageProps {
  /** May be empty/undefined — that alone selects the placeholder, no request is made. */
  src?: string;
  alt: string;
  /** `next/image` `sizes`, required for `fill` images to avoid over-fetching. */
  sizes: string;
  className?: string;
  /** docs/11 §7's LCP hint; only the first row of a grid should set it. */
  priority?: boolean;
}

/** True for sources `next/image`'s optimiser cannot or must not process. */
function mustSkipOptimiser(src: string): boolean {
  return src.startsWith("data:") || src.startsWith("blob:") || src.endsWith(".svg");
}

export function ProductImage({ src, alt, sizes, className, priority = false }: ProductImageProps) {
  const [failed, setFailed] = useState(false);
  const resolved = !src || failed ? PRODUCT_IMAGE_PLACEHOLDER : src;

  return (
    <Image
      // Keyed on the resolved source so React remounts the <img> when the
      // fallback takes over; without this, some browsers keep the failed
      // element's error state and never load the replacement.
      key={resolved}
      src={resolved}
      // The placeholder is decorative once it stands in for a real photo —
      // but the alt text is still the product's name, which is the useful
      // thing to announce either way, so it is not blanked.
      alt={alt}
      fill
      sizes={sizes}
      className={className}
      priority={priority}
      unoptimized={mustSkipOptimiser(resolved)}
      onError={() => setFailed(true)}
    />
  );
}
