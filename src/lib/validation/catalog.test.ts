import { describe, expect, it } from "vitest";
import {
  categoryPathSchema,
  productListInputSchema,
  productSortSchema,
  searchQuerySchema,
  slugSchema,
} from "./catalog";

describe("slugSchema", () => {
  it("accepts a well-formed slug", () => {
    expect(slugSchema.safeParse("hp-victus-15-gaming").success).toBe(true);
  });

  it.each(["Has-Capitals", "trailing-", "-leading", "double--hyphen", "has spaces", ""])(
    "rejects %s",
    (value) => {
      expect(slugSchema.safeParse(value).success).toBe(false);
    },
  );
});

describe("categoryPathSchema", () => {
  it("accepts a single-segment path", () => {
    expect(categoryPathSchema.safeParse("laptops").success).toBe(true);
  });

  it("accepts a multi-segment materialised path", () => {
    expect(categoryPathSchema.safeParse("laptops/gaming").success).toBe(true);
  });

  it("rejects a path with an invalid segment", () => {
    expect(categoryPathSchema.safeParse("laptops/Gaming Laptops").success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(categoryPathSchema.safeParse("").success).toBe(false);
  });
});

describe("productSortSchema", () => {
  it.each(["relevance", "price", "-price", "-createdAt", "-sales", "-discount"])(
    "accepts the whitelisted value %s",
    (value) => {
      expect(productSortSchema.safeParse(value).success).toBe(true);
    },
  );

  it("rejects an unrecognised sort — docs/07 §2's 'unknown keys are a 422, never a silent ignore' rule", () => {
    expect(productSortSchema.safeParse("-popularity").success).toBe(false);
  });
});

describe("productListInputSchema", () => {
  it("fills in the documented defaults when given an empty object", () => {
    const result = productListInputSchema.parse({});
    expect(result).toMatchObject({
      availability: "all",
      sort: "relevance",
      page: 1,
      perPage: 24,
    });
  });

  it("caps perPage at 100 (docs/07 §2's pagination ceiling)", () => {
    expect(productListInputSchema.safeParse({ perPage: 101 }).success).toBe(false);
    expect(productListInputSchema.safeParse({ perPage: 100 }).success).toBe(true);
  });

  it("accepts a fully-populated filter set", () => {
    const result = productListInputSchema.safeParse({
      categoryPath: "laptops/gaming",
      brandSlugs: ["hp", "dell"],
      q: "victus",
      priceGtePaisa: 5000000,
      priceLtePaisa: 20000000,
      specFilters: { ram_gb: ["16", "32"] },
      specRangeFilters: { screen_size_in: { gte: 14, lte: 16 } },
      availability: "in_stock",
      condition: "NEW",
      onSale: true,
      sort: "-price",
      page: 2,
      perPage: 48,
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid condition enum value", () => {
    expect(productListInputSchema.safeParse({ condition: "USED" }).success).toBe(false);
  });

  it("rejects a negative price filter", () => {
    expect(productListInputSchema.safeParse({ priceGtePaisa: -100 }).success).toBe(false);
  });
});

describe("searchQuerySchema", () => {
  it("requires a non-empty query — that's what distinguishes /search from /products", () => {
    expect(searchQuerySchema.safeParse({ q: "" }).success).toBe(false);
  });

  it("trims and accepts a normal query", () => {
    const result = searchQuerySchema.parse({ q: "  gaming laptop  " });
    expect(result.q).toBe("gaming laptop");
    expect(result.page).toBe(1);
    expect(result.perPage).toBe(24);
  });
});
