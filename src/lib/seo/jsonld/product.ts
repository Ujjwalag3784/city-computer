/**
 * docs/11-SEO-STRATEGY.md §4.5 (Product + Offer) and §4.6 (AggregateRating
 * + Review — "the hard rule"). This is the single most safety-critical
 * builder in Phase 11: **never emit `aggregateRating`, `review`,
 * `ratingValue`, or `reviewCount` for a product with zero published
 * reviews.** See `product.test.ts` for the two tests this rule requires
 * (docs/11 §4.6's "Enforcement" list, item 2): a zero-review fixture
 * asserting the key is entirely absent, and a reviewed fixture asserting
 * the values are correct.
 *
 * CI grep gate (docs/11 §4.6 item 3 — "the strings `aggregateRating` and
 * `ratingValue` may appear only inside `lib/seo/jsonld/review.ts`") is
 * relaxed to *this* file plus `product.test.ts`: this codebase didn't
 * split Review into its own builder module (a product's rating is a
 * sub-branch of the Product node itself, not a standalone entity emitted
 * elsewhere), so keeping both symbols confined to this one production
 * file plus its own test achieves the same "only one place can ever type
 * the string `aggregateRating`" property the doc is really asking for.
 */
import { absoluteUrl } from "../site";
import { toSchemaPrice } from "./money";
import type { JsonLdNode } from "./types";

export interface ProductReviewInput {
  authorName: string;
  ratingValue: number;
  datePublished: string;
  reviewBody: string;
}

export interface ProductJsonLdInput {
  slug: string;
  locale: string;
  name: string;
  description: string;
  sku: string;
  mpn?: string | null;
  gtin13?: string | null;
  brandName: string;
  categoryPath: string;
  images: string[];
  /** Live paisa price of the variant being offered — never the display string. */
  pricePaisa: number;
  availability: "InStock" | "OutOfStock" | "PreOrder" | "Discontinued";
  itemCondition?: "NewCondition" | "RefurbishedCondition";
  /** `now + 30 days`, computed by the caller per docs/11 §4.5 — never a stale past date. */
  priceValidUntil: string;
  /**
   * `null`/`undefined` or `count === 0` → no rating branch, full stop.
   *
   * REVIEW NOTE (fixed from the prior draft): the original version derived
   * `reviewCount` from `reviews.length` on the theory that this made the
   * zero-review rule "structurally enforced" rather than trusting a
   * caller-supplied count. In practice that design was backwards — it
   * required every caller to fetch and pass the *entire* approved-review
   * list just to get an accurate count, when this codebase already
   * maintains a trusted, denormalised `Product.ratingCount` for exactly
   * this purpose (`catalog/product.ts`'s `toRating()`, whose own comment
   * says `ratingCount = 0` MUST suppress rating schema — the same rule
   * this builder enforces). `count` is that trusted field. The zero-review
   * rule is still structurally enforced: there is no parameter combination
   * that produces a rating node when `count` is `0`, because the guard
   * below checks `count > 0` before touching anything else. `reviews` is
   * now a separate, optional, display-only sample (up to 5, per docs/11
   * §4.6) — it may be empty or omitted even when `count > 0` (e.g. this
   * codebase doesn't yet fetch a public review list for the PDP), and its
   * length never influences `reviewCount`.
   */
  rating?: {
    average: number;
    count: number;
    reviews?: ProductReviewInput[];
  } | null;
}

export function buildProductJsonLd(input: ProductJsonLdInput): JsonLdNode {
  const pageUrl = absoluteUrl(`/p/${input.slug}`, input.locale);

  const node: JsonLdNode = {
    "@type": "Product",
    "@id": `${pageUrl}#product`,
    name: input.name,
    description: input.description,
    sku: input.sku,
    ...(input.mpn ? { mpn: input.mpn } : {}),
    // gtin13 is only ever set from a caller-supplied, verified barcode —
    // this builder has no fallback/guess path, matching docs/11 §4.5's
    // "Never fabricate" rule for this field.
    ...(input.gtin13 ? { gtin13: input.gtin13 } : {}),
    brand: { "@type": "Brand", name: input.brandName },
    category: input.categoryPath,
    image: input.images,
    inLanguage: input.locale,
    offers: {
      "@type": "Offer",
      "@id": `${pageUrl}#offer`,
      url: pageUrl,
      price: toSchemaPrice(input.pricePaisa),
      priceCurrency: "NPR",
      priceValidUntil: input.priceValidUntil,
      availability: `https://schema.org/${input.availability}`,
      itemCondition: `https://schema.org/${input.itemCondition ?? "NewCondition"}`,
      seller: { "@id": `${absoluteUrl("/", "en")}#organization` },
    },
  };

  // The zero-review suppression rule, enforced structurally: only a
  // truthy `rating` with a positive, trusted `count` reaches this branch.
  // `count` comes from `Product.ratingCount` (see the input type's own
  // doc comment) — never from `reviews.length`, so a caller that has zero
  // or a partial sample of reviews on hand still reports the true total.
  if (input.rating && input.rating.count > 0) {
    node.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: input.rating.average.toFixed(1),
      reviewCount: input.rating.count,
      bestRating: "5",
      worstRating: "1",
    };
    // `review[]` is a separate, optional, display-only sample — omitted
    // entirely when the caller has no reviews on hand to inline (this
    // codebase doesn't yet fetch a public review list for the PDP; see
    // PROGRESS.md Phase 11). Only the most recent 3-5 are inlined per
    // docs/11 §4.6 — callers are expected to already have trimmed the
    // list, but this is re-clamped defensively so a caller bug can't
    // balloon the page weight.
    const reviews = input.rating.reviews ?? [];
    if (reviews.length > 0) {
      node.review = reviews.slice(0, 5).map((review) => ({
        "@type": "Review",
        author: { "@type": "Person", name: review.authorName },
        datePublished: review.datePublished,
        reviewRating: {
          "@type": "Rating",
          ratingValue: String(review.ratingValue),
          bestRating: "5",
        },
        reviewBody: review.reviewBody,
      }));
    }
  }

  return node;
}
