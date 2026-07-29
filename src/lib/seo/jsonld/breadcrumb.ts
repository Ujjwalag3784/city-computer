/**
 * docs/11-SEO-STRATEGY.md §4.4 — BreadcrumbList, built from the exact same
 * `{label, href}[]` shape `components/layout/breadcrumbs.tsx` renders, so
 * the visible trail and the markup can never diverge (the doc's own
 * "footer Webcams→motherboards" cautionary tale, defect #10).
 */
import { absoluteUrl } from "../site";
import type { JsonLdNode } from "./types";

export interface BreadcrumbTrailItem {
  label: string;
  href?: string;
}

/**
 * `items` should already include "Home" as the first entry if the page
 * wants it in the visible trail — callers of the visible `<Breadcrumbs>`
 * component in this codebase omit Home (it renders a home icon
 * out-of-band), so this builder prepends it itself to keep the JSON-LD
 * trail complete per docs/11 §4.4's own example (`position: 1` is always
 * "Home"). Pass `includeHome: false` for the rare case a caller already
 * included it.
 */
export function buildBreadcrumbListJsonLd(
  items: BreadcrumbTrailItem[],
  locale: string,
  options: { includeHome?: boolean; pageUrl: string } = { includeHome: true, pageUrl: "" },
): JsonLdNode {
  const includeHome = options.includeHome ?? true;
  const trail = includeHome ? [{ label: "Home", href: "/" }, ...items] : items;

  return {
    "@type": "BreadcrumbList",
    "@id": `${options.pageUrl}#breadcrumb`,
    itemListElement: trail.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.label,
      // The last item is the current page and must omit `item` per docs/11 §4.4.
      ...(index < trail.length - 1 && item.href ? { item: absoluteUrl(item.href, locale) } : {}),
    })),
  };
}
