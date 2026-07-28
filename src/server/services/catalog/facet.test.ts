import { beforeEach, describe, expect, it, vi } from "vitest";

// facet.ts pulls in brand.ts's getBrandsByIds, which itself imports
// `@/server/db` — one shared mock covers both.
vi.mock("@/server/db", () => ({
  db: {
    product: { groupBy: vi.fn() },
    brand: { findMany: vi.fn() },
    productSpec: { findMany: vi.fn() },
    variant: { aggregate: vi.fn() },
    category: { findUnique: vi.fn() },
    specField: { findMany: vi.fn() },
  },
}));

const { db } = await import("@/server/db");
const { buildCatalogFacets, getFilterableSpecKeys } = await import("./facet");

function decimal(value: number) {
  return { toNumber: () => value };
}

beforeEach(() => {
  vi.mocked(db.product.groupBy).mockReset();
  vi.mocked(db.brand.findMany).mockReset();
  vi.mocked(db.productSpec.findMany).mockReset();
  vi.mocked(db.variant.aggregate).mockReset();
  vi.mocked(db.category.findUnique).mockReset();
  vi.mocked(db.specField.findMany).mockReset();
});

describe("buildCatalogFacets", () => {
  it("returns empty facets without touching the database for an empty id set", async () => {
    const facets = await buildCatalogFacets([]);
    expect(facets).toEqual({ brands: [], specs: [], priceRange: null });
    expect(db.product.groupBy).not.toHaveBeenCalled();
  });

  it("builds brand counts sorted descending", async () => {
    vi.mocked(db.product.groupBy).mockResolvedValue([
      { brandId: "b_hp", _count: { _all: 3 } },
      { brandId: "b_dell", _count: { _all: 7 } },
    ] as never);
    vi.mocked(db.brand.findMany).mockResolvedValue([
      { id: "b_hp", slug: "hp", name: "HP", logoId: null },
      { id: "b_dell", slug: "dell", name: "Dell", logoId: null },
    ] as never);
    vi.mocked(db.productSpec.findMany).mockResolvedValue([]);
    vi.mocked(db.variant.aggregate).mockResolvedValue({
      _min: { pricePaisa: null },
      _max: { pricePaisa: null },
    } as never);

    const facets = await buildCatalogFacets(["p1", "p2"]);

    expect(facets.brands).toEqual([
      { id: "b_dell", slug: "dell", name: "Dell", logoId: null, count: 7 },
      { id: "b_hp", slug: "hp", name: "HP", logoId: null, count: 3 },
    ]);
  });

  it("classifies a key as a NUMBER facet when a majority of its rows carry a numeric value", async () => {
    vi.mocked(db.product.groupBy).mockResolvedValue([]);
    vi.mocked(db.brand.findMany).mockResolvedValue([]);
    vi.mocked(db.productSpec.findMany).mockResolvedValue([
      { key: "ram_gb", label: "RAM", unit: "GB", valueText: null, valueNumber: decimal(8) },
      { key: "ram_gb", label: "RAM", unit: "GB", valueText: null, valueNumber: decimal(16) },
      { key: "ram_gb", label: "RAM", unit: "GB", valueText: null, valueNumber: decimal(32) },
    ] as never);
    vi.mocked(db.variant.aggregate).mockResolvedValue({
      _min: { pricePaisa: 1000000 },
      _max: { pricePaisa: 2000000 },
    } as never);

    const facets = await buildCatalogFacets(["p1"]);

    expect(facets.specs).toEqual([
      { key: "ram_gb", label: "RAM", dataType: "NUMBER", unit: "GB", min: 8, max: 32 },
    ]);
    expect(facets.priceRange).toEqual({ minPaisa: 1000000, maxPaisa: 2000000 });
  });

  it("classifies a key as a TEXT facet, with per-value counts sorted descending, when values are mostly text", async () => {
    vi.mocked(db.product.groupBy).mockResolvedValue([]);
    vi.mocked(db.brand.findMany).mockResolvedValue([]);
    vi.mocked(db.productSpec.findMany).mockResolvedValue([
      { key: "color", label: "Colour", unit: null, valueText: "Black", valueNumber: null },
      { key: "color", label: "Colour", unit: null, valueText: "Black", valueNumber: null },
      { key: "color", label: "Colour", unit: null, valueText: "Silver", valueNumber: null },
    ] as never);
    vi.mocked(db.variant.aggregate).mockResolvedValue({
      _min: { pricePaisa: null },
      _max: { pricePaisa: null },
    } as never);

    const facets = await buildCatalogFacets(["p1"]);

    expect(facets.specs).toEqual([
      {
        key: "color",
        label: "Colour",
        dataType: "TEXT",
        unit: null,
        options: [
          { value: "Black", label: "Black", count: 2 },
          { value: "Silver", label: "Silver", count: 1 },
        ],
      },
    ]);
  });

  it("returns a null priceRange when no active variant has a price", async () => {
    vi.mocked(db.product.groupBy).mockResolvedValue([]);
    vi.mocked(db.brand.findMany).mockResolvedValue([]);
    vi.mocked(db.productSpec.findMany).mockResolvedValue([]);
    vi.mocked(db.variant.aggregate).mockResolvedValue({
      _min: { pricePaisa: null },
      _max: { pricePaisa: null },
    } as never);

    const facets = await buildCatalogFacets(["p1"]);
    expect(facets.priceRange).toBeNull();
  });
});

describe("getFilterableSpecKeys", () => {
  it("returns every filterable key across all templates when no category is given", async () => {
    vi.mocked(db.specField.findMany).mockResolvedValue([
      { key: "ram_gb" },
      { key: "storage_gb" },
    ] as never);

    const keys = await getFilterableSpecKeys();

    expect(db.specField.findMany).toHaveBeenCalledWith({
      where: { isFilterable: true },
      select: { key: true },
    });
    expect(keys).toEqual(new Set(["ram_gb", "storage_gb"]));
  });

  it("returns an empty set when the category has no spec template assigned", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue({ specTemplateId: null } as never);

    const keys = await getFilterableSpecKeys("cat_laptops");

    expect(keys.size).toBe(0);
    expect(db.specField.findMany).not.toHaveBeenCalled();
  });

  it("scopes the whitelist to the category's active spec template", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue({
      specTemplateId: "template_laptop",
    } as never);
    vi.mocked(db.specField.findMany).mockResolvedValue([{ key: "ram_gb" }] as never);

    const keys = await getFilterableSpecKeys("cat_laptops");

    expect(db.specField.findMany).toHaveBeenCalledWith({
      where: { templateId: "template_laptop", isFilterable: true },
      select: { key: true },
    });
    expect(keys).toEqual(new Set(["ram_gb"]));
  });
});
