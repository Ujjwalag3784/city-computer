import { describe, expect, it } from "vitest";
import { buildProductJsonLd, type ProductJsonLdInput } from "./product";

function baseInput(overrides: Partial<ProductJsonLdInput> = {}): ProductJsonLdInput {
  return {
    slug: "asus-tuf-a15-r7-rtx4060",
    locale: "en",
    name: "ASUS TUF Gaming A15",
    description: "A capable mid-range gaming laptop.",
    sku: "TUF-A15-001",
    brandName: "ASUS",
    categoryPath: "Laptops > Gaming Laptops",
    images: ["https://cdn.citycomputer.com.np/products/tuf-a15-1.jpg"],
    pricePaisa: 16490000,
    availability: "InStock",
    priceValidUntil: "2026-08-29",
    ...overrides,
  };
}

describe("buildProductJsonLd — zero-review suppression (safety-critical)", () => {
  it("emits no aggregateRating/review keys at all when rating is omitted", () => {
    const node = buildProductJsonLd(baseInput());
    expect(node.aggregateRating).toBeUndefined();
    expect(node.review).toBeUndefined();
    expect(Object.keys(node)).not.toContain("aggregateRating");
    expect(Object.keys(node)).not.toContain("review");
  });

  it("emits no aggregateRating/review keys when rating is explicitly null", () => {
    const node = buildProductJsonLd(baseInput({ rating: null }));
    expect(node.aggregateRating).toBeUndefined();
    expect(node.review).toBeUndefined();
  });

  it("emits no aggregateRating/review keys when rating.count is 0, even with a non-zero average", () => {
    // A product that briefly had reviews deleted/rejected back down to zero
    // — average might still be a stale non-null number in some upstream
    // data path. count === 0 must win regardless of what average says.
    const node = buildProductJsonLd(baseInput({ rating: { average: 4.2, count: 0 } }));
    expect(node.aggregateRating).toBeUndefined();
    expect(node.review).toBeUndefined();
    expect(JSON.stringify(node)).not.toContain("aggregateRating");
    expect(JSON.stringify(node)).not.toContain("ratingValue");
  });

  it("emits no review[] even when count > 0 but no sample reviews were fetched", () => {
    const node = buildProductJsonLd(
      baseInput({ rating: { average: 4.5, count: 12, reviews: [] } }),
    );
    expect(node.aggregateRating).toBeDefined();
    expect(node.review).toBeUndefined();
  });
});

describe("buildProductJsonLd — reviewed product", () => {
  it("emits a correct aggregateRating using the trusted count, not the sample size", () => {
    const node = buildProductJsonLd(
      baseInput({
        rating: {
          average: 4.6667,
          count: 23,
          reviews: [
            {
              authorName: "Ramesh S.",
              ratingValue: 5,
              datePublished: "2026-06-01",
              reviewBody: "Great value for money.",
            },
          ],
        },
      }),
    );
    const aggregateRating = node.aggregateRating as Record<string, unknown>;
    expect(aggregateRating["@type"]).toBe("AggregateRating");
    expect(aggregateRating.ratingValue).toBe("4.7");
    expect(aggregateRating.reviewCount).toBe(23);
    expect(aggregateRating.bestRating).toBe("5");
    expect(aggregateRating.worstRating).toBe("1");
  });

  it("inlines the sample reviews, clamped to 5 even if more are passed", () => {
    const reviews = Array.from({ length: 8 }, (_, i) => ({
      authorName: `Customer ${i}`,
      ratingValue: 5,
      datePublished: "2026-06-01",
      reviewBody: `Review body ${i}`,
    }));
    const node = buildProductJsonLd(baseInput({ rating: { average: 5, count: 8, reviews } }));
    expect(node.review).toHaveLength(5);
  });
});

describe("buildProductJsonLd — Offer / money", () => {
  it("serialises pricePaisa as a two-decimal rupee string, never the paisa integer", () => {
    const node = buildProductJsonLd(baseInput({ pricePaisa: 16490000 }));
    const offers = node.offers as Record<string, unknown>;
    expect(offers.price).toBe("164900.00");
    expect(offers.priceCurrency).toBe("NPR");
  });

  it("maps availability to a full schema.org URL", () => {
    const node = buildProductJsonLd(baseInput({ availability: "OutOfStock" }));
    const offers = node.offers as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/OutOfStock");
  });

  it("defaults itemCondition to NewCondition when not supplied", () => {
    const node = buildProductJsonLd(baseInput());
    const offers = node.offers as Record<string, unknown>;
    expect(offers.itemCondition).toBe("https://schema.org/NewCondition");
  });

  it("never fabricates gtin13 when none is supplied", () => {
    const node = buildProductJsonLd(baseInput());
    expect(node.gtin13).toBeUndefined();
  });
});
