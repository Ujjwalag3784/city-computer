import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  db: {
    variant: { findMany: vi.fn(), count: vi.fn() },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("./stock", () => ({
  getDefaultBranchId: vi.fn(),
  getPrimaryStockLevelsByVariantId: vi.fn(),
  adjustVariantStock: vi.fn(),
}));

vi.mock("./audit-log", () => ({
  listAuditLog: vi.fn(),
}));

const { db } = await import("@/server/db");
const { getDefaultBranchId, getPrimaryStockLevelsByVariantId, adjustVariantStock } = await import(
  "./stock"
);
const { listAuditLog } = await import("./audit-log");
const { listStockForAdmin, getStockHistoryForVariant, bulkAdjustStock } = await import(
  "./inventory"
);

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

beforeEach(() => {
  vi.mocked(db.variant.findMany)
    .mockReset()
    .mockResolvedValue([] as never);
  vi.mocked(db.variant.count)
    .mockReset()
    .mockResolvedValue(0 as never);
  vi.mocked(db.$queryRaw).mockReset();
  vi.mocked(getDefaultBranchId).mockReset().mockResolvedValue(null);
  vi.mocked(getPrimaryStockLevelsByVariantId).mockReset().mockResolvedValue(new Map());
  vi.mocked(adjustVariantStock).mockReset();
  vi.mocked(listAuditLog).mockReset();
});

// ---------------------------------------------------------------------------
// listStockForAdmin — docs/09 §6's search box + "Almost out of stock" /
// "Out of stock" filter chips, mapped to a Prisma `where`.
// ---------------------------------------------------------------------------
describe("listStockForAdmin", () => {
  it("searches by product name or product code for a typed query", async () => {
    await listStockForAdmin({ q: "victus", filter: "all", page: 1 });

    expect(db.variant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { sku: { contains: "victus", mode: "insensitive" } },
            { product: { name: { contains: "victus", mode: "insensitive" } } },
          ],
        }),
      }),
    );
  });

  it("shows nothing for a stock filter when there's no default branch to check", async () => {
    vi.mocked(getDefaultBranchId).mockResolvedValue(null);

    await listStockForAdmin({ filter: "out-of-stock", page: 1 });

    expect(db.$queryRaw).not.toHaveBeenCalled();
    expect(db.variant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: { in: [] } }) }),
    );
  });

  it("resolves the 'low-stock' chip to the exact variant ids the branch query returns", async () => {
    vi.mocked(getDefaultBranchId).mockResolvedValue("branch_1");
    vi.mocked(db.$queryRaw).mockResolvedValue([{ id: "variant_1" }, { id: "variant_2" }] as never);

    await listStockForAdmin({ filter: "low-stock", page: 1 });

    expect(db.variant.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: ["variant_1", "variant_2"] } }),
      }),
    );
  });

  it("fills in quantity/reserved/available from the batch stock lookup", async () => {
    vi.mocked(db.variant.findMany).mockResolvedValue([
      {
        id: "variant_1",
        productId: "product_1",
        sku: "HP-VIC15-001",
        lowStockThreshold: 3,
        product: { name: "HP Victus 15", brand: { name: "HP" } },
      },
    ] as never);
    vi.mocked(db.variant.count).mockResolvedValue(1);
    vi.mocked(getPrimaryStockLevelsByVariantId).mockResolvedValue(
      new Map([
        [
          "variant_1",
          {
            branchId: "branch_1",
            branchName: "Main",
            quantity: 10,
            reservedQuantity: 2,
            availableQuantity: 8,
          },
        ],
      ]),
    );

    const result = await listStockForAdmin({ filter: "all", page: 1 });

    expect(result.items).toEqual([
      expect.objectContaining({
        variantId: "variant_1",
        productName: "HP Victus 15",
        brandName: "HP",
        productCode: "HP-VIC15-001",
        quantity: 10,
        reservedQuantity: 2,
        availableQuantity: 8,
        lowStockThreshold: 3,
      }),
    ]);
    expect(result.total).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// getStockHistoryForVariant — docs/09 §6 "Stock history": reads straight
// from the shared AuditLog rather than a bespoke query.
// ---------------------------------------------------------------------------
describe("getStockHistoryForVariant", () => {
  it("asks for only this variant's stock.adjusted entries", async () => {
    vi.mocked(listAuditLog).mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      perPage: 25,
      hasNext: false,
    });

    await getStockHistoryForVariant("variant_1");

    expect(listAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "Variant",
        entityId: "variant_1",
        action: "stock.adjusted",
      }),
    );
  });

  it("maps each AuditLog entry to a plain-language-ready history row", async () => {
    vi.mocked(listAuditLog).mockResolvedValue({
      items: [
        {
          id: "log_1",
          actorId: "user_1",
          actorEmail: "ramesh@citycomputer.com.np",
          action: "stock.adjusted",
          entityType: "Variant",
          entityId: "variant_1",
          before: { quantity: 7 },
          after: { quantity: 12, delta: 5, reason: "PURCHASE" },
          createdAt: new Date("2026-07-27T04:29:00Z"),
        },
      ],
      total: 1,
      page: 1,
      perPage: 25,
      hasNext: false,
    });

    const result = await getStockHistoryForVariant("variant_1");

    expect(result.items).toEqual([
      expect.objectContaining({
        delta: 5,
        quantityAfter: 12,
        reason: "PURCHASE",
        reasonLabel: "Received new stock",
        actorLabel: "ramesh@citycomputer.com.np",
      }),
    ]);
  });

  it("falls back gracefully when a log entry's `after` JSON is missing an expected field", async () => {
    vi.mocked(listAuditLog).mockResolvedValue({
      items: [
        {
          id: "log_1",
          actorId: null,
          actorEmail: null,
          action: "stock.adjusted",
          entityType: "Variant",
          entityId: "variant_1",
          before: null,
          after: null,
          createdAt: new Date("2026-07-27T04:29:00Z"),
        },
      ],
      total: 1,
      page: 1,
      perPage: 25,
      hasNext: false,
    });

    const result = await getStockHistoryForVariant("variant_1");

    expect(result.items[0]).toMatchObject({ delta: 0, quantityAfter: 0, actorLabel: "Someone" });
  });
});

// ---------------------------------------------------------------------------
// bulkAdjustStock — docs/09 §6 "Bulk update": every row still goes through
// `adjustVariantStock`, and one row's failure doesn't abort the rest.
// ---------------------------------------------------------------------------
describe("bulkAdjustStock", () => {
  it("adjusts every row with the shared reason and note", async () => {
    vi.mocked(adjustVariantStock).mockResolvedValue({
      branchId: "branch_1",
      branchName: "Main",
      quantity: 10,
      reservedQuantity: 0,
      availableQuantity: 10,
    });

    const result = await bulkAdjustStock(
      [
        { variantId: "variant_1", quantity: 10 },
        { variantId: "variant_2", quantity: 0 },
      ],
      "CORRECTION",
      "Monthly count",
      ACTOR,
    );

    expect(adjustVariantStock).toHaveBeenCalledTimes(2);
    expect(adjustVariantStock).toHaveBeenCalledWith(
      "variant_1",
      10,
      "CORRECTION",
      ACTOR,
      "Monthly count",
    );
    expect(adjustVariantStock).toHaveBeenCalledWith(
      "variant_2",
      0,
      "CORRECTION",
      ACTOR,
      "Monthly count",
    );
    expect(result).toEqual({ updatedCount: 2, failedVariantIds: [] });
  });

  it("isolates one row's failure so the rest still save", async () => {
    vi.mocked(adjustVariantStock)
      .mockResolvedValueOnce({
        branchId: "branch_1",
        branchName: "Main",
        quantity: 5,
        reservedQuantity: 0,
        availableQuantity: 5,
      })
      .mockRejectedValueOnce(new Error("Product option not found"))
      .mockResolvedValueOnce({
        branchId: "branch_1",
        branchName: "Main",
        quantity: 1,
        reservedQuantity: 0,
        availableQuantity: 1,
      });

    const result = await bulkAdjustStock(
      [
        { variantId: "variant_1", quantity: 5 },
        { variantId: "variant_missing", quantity: 3 },
        { variantId: "variant_3", quantity: 1 },
      ],
      "CORRECTION",
      undefined,
      ACTOR,
    );

    expect(result).toEqual({ updatedCount: 2, failedVariantIds: ["variant_missing"] });
  });
});
