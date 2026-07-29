/**
 * docs/11-SEO-STRATEGY.md §4.9/§4.13 — ItemList + CollectionPage, emitted
 * on listing routes (`/`, `/c/*`, `/b/*`, `/search`-adjacent `/shop`,
 * `/blog`, `/stores`).
 *
 * Gotchas from the doc, both enforced here:
 * - "URL-only `ListItem`s ... do not inline full `Product` nodes on
 *   listing pages — it bloats HTML and risks price/availability drift
 *   against the PDP." `ItemListEntry` below is deliberately just
 *   `{ url, name? }`, not a place to smuggle a full Product node.
 * - "`position` is continuous across pagination (page 2 starts at 25)" —
 *   `startPosition` lets a paginated caller pass the right offset instead
 *   of every page restarting at 1.
 */
import { absoluteUrl } from "../site";
import type { JsonLdNode } from "./types";

export interface ItemListEntry {
  /** Locale-relative path, e.g. `/p/asus-tuf-a15`. */
  href: string;
  name?: string;
}

export interface ItemListInput {
  locale: string;
  pageUrl: string;
  items: ItemListEntry[];
  /** 1-based position of the first item on this page — defaults to 1 for an unpaginated list. */
  startPosition?: number;
  /** Total count across all pages, if different from `items.length` (e.g. this page is a slice). */
  numberOfItems?: number;
  order?: "ascending" | "descending";
}

export function buildItemListJsonLd(input: ItemListInput): JsonLdNode {
  const start = input.startPosition ?? 1;
  return {
    "@type": "ItemList",
    "@id": `${input.pageUrl}#itemlist`,
    itemListOrder:
      input.order === "descending"
        ? "https://schema.org/ItemListOrderDescending"
        : "https://schema.org/ItemListOrderAscending",
    numberOfItems: input.numberOfItems ?? input.items.length,
    itemListElement: input.items.map((item, index) => ({
      "@type": "ListItem",
      position: start + index,
      url: absoluteUrl(item.href, input.locale),
      ...(item.name ? { name: item.name } : {}),
    })),
  };
}

export interface CollectionPageInput {
  locale: string;
  pageUrl: string;
  name: string;
  description?: string;
}

/**
 * `CollectionPage` — the doc names this type in its route-coverage matrix
 * (§4.13) but gives no worked example/property list, so this builder
 * sticks to the small set of properties every `WebPage` subtype
 * legitimately carries: name, description, url, and inLanguage.
 */
export function buildCollectionPageJsonLd(input: CollectionPageInput): JsonLdNode {
  return {
    "@type": "CollectionPage",
    "@id": `${input.pageUrl}#webpage`,
    url: input.pageUrl,
    name: input.name,
    ...(input.description ? { description: input.description } : {}),
    inLanguage: input.locale,
    isPartOf: { "@id": `${absoluteUrl("/", "en")}#website` },
  };
}
