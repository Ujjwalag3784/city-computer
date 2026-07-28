import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";

vi.mock("@/server/db", () => ({
  db: {
    branch: { findFirst: vi.fn() },
    variant: { findUnique: vi.fn() },
    stockLevel: { findUnique: vi.fn(), upsert: vi.fn() },
    stockMovement: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { adjustVariantStock } = await import("./stock");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };
const BRANCH_ID = "branch_1";

function stockLevelRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    variantId: "variant_1",
    branchId: BRANCH_ID,
    quantity: 5,
    reservedQuantity: 0,
    branch: { name: "Main Store" },
    ...overrides,
  };
}

beforeEach(() => {
  // `getDefaultBranchId` caches its result for the process lifetime (see
  // `stock.ts`'s own doc comment) — every test in this file gets a
  // resolved branch on the first call, exercised once, then reused.
  vi.mocked(db.branch.findFirst)
    .mockReset()
    .mockResolvedValue({ id: BRANCH_ID } as never);
  vi.mocked(db.variant.findUnique).mockReset();
  vi.mocked(db.stockLevel.findUnique).mockReset();
  vi.mocked(db.stockLevel.upsert).mockReset();
  vi.mocked(db.stockMovement.create).mockReset();
  vi.mocked(db.$transaction).mockReset();
  vi.mocked(recordAuditLog).mockClear();
});

describe("adjustVariantStock", () => {
  it("throws NotFoundError for a variant that doesn't exist", async () => {
    vi.mocked(db.variant.findUnique).mockResolvedValue(null as never);

    await expect(
      adjustVariantStock("variant_missing", 5, "CORRECTION", ACTOR),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("upserts the level but writes no StockMovement when the quantity hasn't changed", async () => {
    vi.mocked(db.variant.findUnique).mockResolvedValue({ id: "variant_1" } as never);
    vi.mocked(db.stockLevel.findUnique).mockResolvedValue(stockLevelRow({ quantity: 5 }) as never);
    vi.mocked(db.stockLevel.upsert).mockResolvedValue(stockLevelRow({ quantity: 5 }) as never);

    const result = await adjustVariantStock("variant_1", 5, "CORRECTION", ACTOR);

    expect(db.stockLevel.upsert).toHaveBeenCalled();
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.stockMovement.create).not.toHaveBeenCalled();
    expect(recordAuditLog).not.toHaveBeenCalled();
    expect(result.quantity).toBe(5);
  });

  it("writes a signed StockMovement and an AuditLog entry when the quantity increases", async () => {
    vi.mocked(db.variant.findUnique).mockResolvedValue({ id: "variant_1" } as never);
    vi.mocked(db.stockLevel.findUnique).mockResolvedValue(stockLevelRow({ quantity: 5 }) as never);
    vi.mocked(db.$transaction).mockResolvedValue([stockLevelRow({ quantity: 8 }), {}] as never);

    const result = await adjustVariantStock("variant_1", 8, "CORRECTION", ACTOR, "Recount");

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    const batch = vi.mocked(db.$transaction).mock.calls[0]?.[0] as unknown as unknown[];
    expect(batch).toHaveLength(2);
    expect(db.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delta: 3, reason: "CORRECTION", note: "Recount" }),
      }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "stock.adjusted",
        before: { quantity: 5 },
        after: expect.objectContaining({ quantity: 8, delta: 3 }),
      }),
    );
    expect(result.quantity).toBe(8);
  });

  it("treats a variant with no StockLevel row yet as starting from zero", async () => {
    vi.mocked(db.variant.findUnique).mockResolvedValue({ id: "variant_1" } as never);
    vi.mocked(db.stockLevel.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.$transaction).mockResolvedValue([stockLevelRow({ quantity: 10 }), {}] as never);

    await adjustVariantStock("variant_1", 10, "INITIAL", ACTOR);

    expect(db.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ delta: 10, reason: "INITIAL" }) }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ before: { quantity: 0 } }),
    );
  });

  it("clamps availableQuantity at zero when reserved stock exceeds the quantity", async () => {
    vi.mocked(db.variant.findUnique).mockResolvedValue({ id: "variant_1" } as never);
    vi.mocked(db.stockLevel.findUnique).mockResolvedValue(stockLevelRow({ quantity: 5 }) as never);
    vi.mocked(db.stockLevel.upsert).mockResolvedValue(
      stockLevelRow({ quantity: 5, reservedQuantity: 9 }) as never,
    );

    const result = await adjustVariantStock("variant_1", 5, "CORRECTION", ACTOR);

    expect(result.availableQuantity).toBe(0);
  });
});
