import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";

vi.mock("@/server/db", () => ({
  db: {
    product: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    category: {
      findUnique: vi.fn(),
    },
    specField: {
      findMany: vi.fn(),
    },
    variant: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./stock", () => ({
  getDefaultBranchId: vi.fn(),
  getPrimaryStockLevelsByVariantId: vi.fn(),
  adjustVariantStock: vi.fn(),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { getDefaultBranchId, getPrimaryStockLevelsByVariantId } = await import("./stock");
const {
  findSimilarProductNames,
  getSpecTemplateFields,
  getPublishReadiness,
  quickUpdatePrice,
  listProductsForAdmin,
} = await import("./product");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

beforeEach(() => {
  vi.mocked(db.product.findUnique).mockReset();
  vi.mocked(db.product.findMany)
    .mockReset()
    .mockResolvedValue([] as never);
  vi.mocked(db.product.count)
    .mockReset()
    .mockResolvedValue(0 as never);
  vi.mocked(db.category.findUnique).mockReset();
  vi.mocked(db.specField.findMany).mockReset();
  vi.mocked(db.variant.findUnique).mockReset();
  vi.mocked(db.variant.update).mockReset();
  vi.mocked(db.$queryRaw).mockReset();
  vi.mocked(recordAuditLog).mockClear();
  vi.mocked(getDefaultBranchId).mockReset().mockResolvedValue(null);
  vi.mocked(getPrimaryStockLevelsByVariantId).mockReset().mockResolvedValue(new Map());
});

// ---------------------------------------------------------------------------
// findSimilarProductNames — docs/09 §5.1 Step 1's on-blur duplicate check.
// Fails open (returns []) rather than blocking product creation if
// pg_trgm isn't installed on this database yet.
// ---------------------------------------------------------------------------
describe("findSimilarProductNames", () => {
  it("returns no candidates for a blank name, without querying the database", async () => {
    const result = await findSimilarProductNames("   ");
    expect(result).toEqual([]);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("returns the trigram-similarity rows the query finds", async () => {
    const rows = [{ id: "product_1", name: "HP Victus 15", slug: "hp-victus-15", similarity: 0.9 }];
    vi.mocked(db.$queryRaw).mockResolvedValue(rows as never);

    const result = await findSimilarProductNames("HP Victus 15 Gaming");

    expect(result).toEqual(rows);
  });

  it("fails open (returns []) if the underlying query throws — e.g. pg_trgm not installed", async () => {
    vi.mocked(db.$queryRaw).mockRejectedValue(
      new Error("function similarity(text, text) does not exist"),
    );

    const result = await findSimilarProductNames("HP Victus 15");

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getSpecTemplateFields — docs/09 §5.1 Step 3: falls back to no template
// fields (just the "+ Add another detail" escape hatch) for a category
// that has none, rather than throwing.
// ---------------------------------------------------------------------------
describe("getSpecTemplateFields", () => {
  it("returns an empty list when the category has no spec template", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue({ specTemplateId: null } as never);

    const result = await getSpecTemplateFields("category_custom");

    expect(result).toEqual([]);
    expect(db.specField.findMany).not.toHaveBeenCalled();
  });

  it("returns the template's fields, mapped to the admin shape", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue({ specTemplateId: "template_1" } as never);
    vi.mocked(db.specField.findMany).mockResolvedValue([
      {
        key: "processor",
        label: "Processor",
        helpText: null,
        dataType: "TEXT",
        unit: null,
        options: [],
        isRequired: false,
        group: null,
      },
    ] as never);

    const result = await getSpecTemplateFields("category_laptop");

    expect(result).toEqual([
      expect.objectContaining({ key: "processor", label: "Processor", dataType: "TEXT" }),
    ]);
  });
});

// ---------------------------------------------------------------------------
// getPublishReadiness — docs/09 §5.1 "Publishing": every item is
// informational (never a hard block); allOk only when everything's "ok".
// ---------------------------------------------------------------------------
describe("getPublishReadiness", () => {
  it("throws NotFoundError for a product that doesn't exist", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue(null as never);
    await expect(getPublishReadiness("product_missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("reports allOk when photos, details, and a long-enough search description all exist", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue({
      media: [{ id: "media_1" }],
      specs: [{ id: "spec_1" }],
      metaDescription: "A".repeat(60),
    } as never);

    const result = await getPublishReadiness("product_1");

    expect(result.allOk).toBe(true);
    expect(result.items.every((item) => item.status === "ok")).toBe(true);
  });

  it("flags missing photos and a short search description without blocking", async () => {
    vi.mocked(db.product.findUnique).mockResolvedValue({
      media: [],
      specs: [],
      metaDescription: "Too short",
    } as never);

    const result = await getPublishReadiness("product_1");

    expect(result.allOk).toBe(false);
    expect(result.items.find((item) => item.id === "photos")).toMatchObject({ status: "missing" });
    expect(result.items.find((item) => item.id === "details")).toMatchObject({ status: "warning" });
    expect(result.items.find((item) => item.id === "search-description")).toMatchObject({
      status: "warning",
    });
  });
});

// ---------------------------------------------------------------------------
// quickUpdatePrice — docs/09 §8: "Warn if the new price differs from the
// old by more than 50%" — a non-blocking heads-up, not a rejected save.
// ---------------------------------------------------------------------------
describe("quickUpdatePrice", () => {
  it("throws NotFoundError for a variant that doesn't exist", async () => {
    vi.mocked(db.variant.findUnique).mockResolvedValue(null as never);
    await expect(
      quickUpdatePrice("variant_missing", 10000, undefined, ACTOR),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("saves without a warning for an ordinary price change", async () => {
    vi.mocked(db.variant.findUnique).mockResolvedValue({
      id: "variant_1",
      pricePaisa: 10000,
    } as never);
    vi.mocked(db.variant.update).mockResolvedValue({} as never);

    const result = await quickUpdatePrice("variant_1", 11000, undefined, ACTOR);

    expect(result.warning).toBeUndefined();
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "product.priceChanged" }),
    );
  });

  it("warns when the new price is more than 50% higher than the old price", async () => {
    vi.mocked(db.variant.findUnique).mockResolvedValue({
      id: "variant_1",
      pricePaisa: 10000,
    } as never);
    vi.mocked(db.variant.update).mockResolvedValue({} as never);

    const result = await quickUpdatePrice("variant_1", 20000, undefined, ACTOR);

    expect(result.warning).toMatch(/higher/);
  });

  it("warns when the new price is more than 50% lower than the old price", async () => {
    vi.mocked(db.variant.findUnique).mockResolvedValue({
      id: "variant_1",
      pricePaisa: 10000,
    } as never);
    vi.mocked(db.variant.update).mockResolvedValue({} as never);

    const result = await quickUpdatePrice("variant_1", 4000, undefined, ACTOR);

    expect(result.warning).toMatch(/lower/);
  });

  it("does not warn at exactly the 50% boundary", async () => {
    vi.mocked(db.variant.findUnique).mockResolvedValue({
      id: "variant_1",
      pricePaisa: 10000,
    } as never);
    vi.mocked(db.variant.update).mockResolvedValue({} as never);

    const result = await quickUpdatePrice("variant_1", 15000, undefined, ACTOR);

    expect(result.warning).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// listProductsForAdmin — docs/09 §5.2's filter chips, mapped to a Prisma
// `where`. Verifying the mapping (not real query results, since there's
// no database in this sandbox) is what makes this test meaningful.
// ---------------------------------------------------------------------------
describe("listProductsForAdmin", () => {
  it("filters to live products for the 'live' chip", async () => {
    await listProductsForAdmin({ filter: "live", page: 1 });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE" }) }),
    );
  });

  it("filters to draft products for the 'draft' chip", async () => {
    await listProductsForAdmin({ filter: "draft", page: 1 });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "DRAFT" }) }),
    );
  });

  it("filters to products with no photo for the 'no-photo' chip", async () => {
    await listProductsForAdmin({ filter: "no-photo", page: 1 });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ media: { none: {} } }) }),
    );
  });

  it("filters to products with an offer price for the 'on-offer' chip", async () => {
    await listProductsForAdmin({ filter: "on-offer", page: 1 });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          variants: { some: { compareAtPricePaisa: { not: null } } },
        }),
      }),
    );
  });

  it("searches by name or product code for a typed query", async () => {
    await listProductsForAdmin({ q: "victus", filter: "all", page: 1 });
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "victus", mode: "insensitive" } },
            { variants: { some: { sku: { contains: "victus", mode: "insensitive" } } } },
          ],
        }),
      }),
    );
  });

  it("shows nothing for a stock filter when there's no default branch to check", async () => {
    vi.mocked(getDefaultBranchId).mockResolvedValue(null);

    await listProductsForAdmin({ filter: "out-of-stock", page: 1 });

    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [] } }) }),
    );
  });

  it("resolves the 'out-of-stock' chip to the exact product ids the branch query returns", async () => {
    vi.mocked(getDefaultBranchId).mockResolvedValue("branch_1");
    vi.mocked(db.$queryRaw).mockResolvedValue([
      { product_id: "product_1" },
      { product_id: "product_2" },
    ] as never);

    await listProductsForAdmin({ filter: "out-of-stock", page: 1 });

    expect(db.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["product_1", "product_2"] } }),
      }),
    );
  });
});
