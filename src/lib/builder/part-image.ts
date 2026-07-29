/**
 * Part image resolution — `ComponentPart` has no direct image relation of
 * its own. The only path to a real photo is the optional chain
 * `ComponentPart.variantId -> Variant.productId -> Product -> ProductMedia
 * -> Media`, and per docs §7/§11 only ~4 of the ~25 seeded parts have a
 * `variantId` at all (most are informational-only, priced/spec'd for the
 * engine but not a real sellable SKU with photography).
 *
 * This mirrors the `thumbnail ?? gallery ?? media[0]` selection order
 * `src/server/services/catalog/product.ts`'s `pickCardImage` already uses
 * for real storefront product cards, so a part that *does* have a linked
 * variant shows the exact same photo the PDP would.
 *
 * FLAGGED DATA GAP (docs §11 "component spec data is the single biggest
 * ongoing cost"): a part with no `variantId`, or a linked product with no
 * uploaded media yet, falls back to `PART_IMAGE_PLACEHOLDER` — an inline
 * data-URI SVG (there is no `public/` directory in this repo to hold a
 * static placeholder asset, and creating one solely for this one file is
 * out of scope). Real per-part photography for informational-only parts is
 * a data-sourcing gap, not a bug; it should be tracked in PROGRESS.md
 * rather than silently accepted as "done".
 */

/** A flat, neutral "generic component" glyph — deliberately plain so it reads as "no photo yet", not as a real product shot. */
export const PART_IMAGE_PLACEHOLDER =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
      `<rect width="64" height="64" rx="8" fill="#20242c"/>` +
      `<rect x="16" y="16" width="32" height="32" rx="3" fill="none" stroke="#7a8194" stroke-width="2"/>` +
      `<path d="M24 16v-6M40 16v-6M24 54v-6M40 54v-6M16 24h-6M16 40h-6M54 24h-6M54 40h-6" stroke="#7a8194" stroke-width="2" stroke-linecap="round"/>` +
      `</svg>`,
  );

export interface PartImageRef {
  url: string;
  alt: string;
}

/** The shape this file needs from a `ComponentPart -> Variant -> Product -> ProductMedia -> Media` Prisma `include`; kept minimal so callers can select only these fields. */
export interface PartMediaRow {
  role: string;
  media: {
    cdnUrl: string | null;
    url: string;
    altText: string | null;
  };
}

/** Resolves one part's display image, falling back to `PART_IMAGE_PLACEHOLDER` when there's no linked variant, no linked product media, or the query for either was never run (`media` undefined). */
export function resolvePartImage(
  media: PartMediaRow[] | null | undefined,
  fallbackAlt: string,
): PartImageRef {
  if (!media || media.length === 0) {
    return { url: PART_IMAGE_PLACEHOLDER, alt: fallbackAlt };
  }
  const thumbnail = media.find((entry) => entry.role === "THUMBNAIL");
  const gallery = media.find((entry) => entry.role === "GALLERY");
  const chosen = thumbnail ?? gallery ?? media[0];
  if (!chosen) return { url: PART_IMAGE_PLACEHOLDER, alt: fallbackAlt };
  return { url: chosen.media.cdnUrl ?? chosen.media.url, alt: chosen.media.altText ?? fallbackAlt };
}
