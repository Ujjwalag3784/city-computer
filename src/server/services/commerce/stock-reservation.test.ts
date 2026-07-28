import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";

function makeTx() {
  return {
    $executeRaw: vi.fn(),
    stockLevel: { updateMany: vi.fn() },
    stockReservation: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), findMany: vi.fn() },
    stockMovement: { create: vi.fn() },
  };
}

let tx = makeTx();

vi.mock("@/server/db", () => ({
  db: {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(tx)),
    stockReservation: { findMany: vi.fn() },
  },
}));

const { db } = await import("@/server/db");
const {
  reserveStock,
  consumeReservation,
  releaseReservation,
  releaseExpiredReservations,
  reservationTtlMs,
} = await import("./stock-reservation");

beforeEach(() => {
  tx = makeTx();
  vi.mocked(db.$transaction)
    .mockReset()
    .mockImplementation(async (callback: unknown) => (callback as (tx: unknown) => unknown)(tx));
  vi.mocked(db.stockReservation.findMany).mockReset();
});

describe("reservationTtlMs", () => {
  it("matches docs/06 §5's TTL table", () => {
    expect(reservationTtlMs("WALLET")).toBe(30 * 60 * 1000);
    expect(reservationTtlMs("BANK_TRANSFER")).toBe(24 * 60 * 60 * 1000);
    expect(reservationTtlMs("COD")).toBe(0);
  });
});

describe("reserveStock", () => {
  it("returns an empty array without touching the database for an empty item list", async () => {
    const result = await reserveStock([], { expiresAt: new Date() });
    expect(result).toEqual([]);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("raises INSUFFICIENT_STOCK when the atomic guard affects zero rows (the concurrency-safe path)", async () => {
    tx.$executeRaw.mockResolvedValue(0);

    await expect(
      reserveStock([{ variantId: "variant_1", branchId: "branch_1", quantity: 3 }], {
        expiresAt: new Date(),
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });

    expect(tx.stockReservation.create).not.toHaveBeenCalled();
  });

  it("creates a reservation once the guarded UPDATE affects exactly one row", async () => {
    tx.$executeRaw.mockResolvedValue(1);
    tx.stockReservation.create.mockResolvedValue({ id: "reservation_1" });

    const expiresAt = new Date();
    const result = await reserveStock(
      [{ variantId: "variant_1", branchId: "branch_1", quantity: 2 }],
      { cartId: "cart_1", expiresAt },
    );

    expect(tx.stockReservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          variantId: "variant_1",
          branchId: "branch_1",
          quantity: 2,
          cartId: "cart_1",
          status: "ACTIVE",
        }),
      }),
    );
    expect(result).toEqual([{ id: "reservation_1" }]);
  });

  it("rolls back the whole batch (no reservations created) when one item in a multi-item order can't be reserved", async () => {
    tx.$executeRaw.mockResolvedValueOnce(1).mockResolvedValueOnce(0);
    tx.stockReservation.create.mockResolvedValue({ id: "reservation_1" });

    await expect(
      reserveStock(
        [
          { variantId: "variant_1", branchId: "branch_1", quantity: 1 },
          { variantId: "variant_2", branchId: "branch_1", quantity: 99 },
        ],
        { expiresAt: new Date() },
      ),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK" });
  });

  it("skips the atomic guard for a backorder-eligible variant, using a plain increment instead", async () => {
    tx.stockReservation.create.mockResolvedValue({ id: "reservation_1" });

    await reserveStock([{ variantId: "variant_1", branchId: "branch_1", quantity: 5 }], {
      expiresAt: new Date(),
      allowBackorderVariantIds: new Set(["variant_1"]),
    });

    expect(tx.$executeRaw).not.toHaveBeenCalled();
    expect(tx.stockLevel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reservedQuantity: { increment: 5 } } }),
    );
  });
});

describe("consumeReservation", () => {
  it("throws NotFoundError for a reservation that doesn't exist", async () => {
    tx.stockReservation.findUnique.mockResolvedValue(null);
    await expect(consumeReservation("reservation_missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("throws CONFLICT_VERSION for a reservation that's already been consumed/released", async () => {
    tx.stockReservation.findUnique.mockResolvedValue({ id: "r1", status: "RELEASED" });
    await expect(consumeReservation("r1")).rejects.toMatchObject({ code: "CONFLICT_VERSION" });
  });

  it("decrements both quantity and reservedQuantity and writes a signed SALE movement", async () => {
    tx.stockReservation.findUnique.mockResolvedValue({
      id: "r1",
      status: "ACTIVE",
      variantId: "variant_1",
      branchId: "branch_1",
      quantity: 3,
      orderId: "order_1",
    });

    await consumeReservation("r1", "user_1");

    expect(tx.stockLevel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quantity: { decrement: 3 }, reservedQuantity: { decrement: 3 } },
      }),
    );
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          delta: -3,
          reason: "SALE",
          referenceType: "Order",
          referenceId: "order_1",
        }),
      }),
    );
    expect(tx.stockReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r1" }, data: { status: "CONSUMED" } }),
    );
  });
});

describe("releaseReservation", () => {
  it("is a no-op for a reservation that's no longer ACTIVE", async () => {
    tx.stockReservation.findUnique.mockResolvedValue({ id: "r1", status: "CONSUMED" });

    await releaseReservation("r1");

    expect(tx.stockLevel.updateMany).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it("decrements only reservedQuantity and writes a delta:0 RESERVATION_RELEASE movement", async () => {
    tx.stockReservation.findUnique.mockResolvedValue({
      id: "r1",
      status: "ACTIVE",
      variantId: "variant_1",
      branchId: "branch_1",
      quantity: 4,
    });

    await releaseReservation("r1", "EXPIRED");

    expect(tx.stockLevel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reservedQuantity: { decrement: 4 } } }),
    );
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ delta: 0, reason: "RESERVATION_RELEASE" }),
      }),
    );
    expect(tx.stockReservation.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "EXPIRED" } }),
    );
  });
});

describe("releaseExpiredReservations", () => {
  it("releases every expired ACTIVE reservation and reports the count", async () => {
    vi.mocked(db.stockReservation.findMany).mockResolvedValue([
      { id: "r1" },
      { id: "r2" },
    ] as never);
    tx.stockReservation.findUnique.mockResolvedValue({
      id: "r1",
      status: "ACTIVE",
      variantId: "variant_1",
      branchId: "branch_1",
      quantity: 1,
    });

    const result = await releaseExpiredReservations(new Date());

    expect(result.releasedCount).toBe(2);
    expect(result.failedReservationIds).toEqual([]);
  });

  it("isolates one reservation's release failure from the rest of the sweep", async () => {
    vi.mocked(db.stockReservation.findMany).mockResolvedValue([
      { id: "r1" },
      { id: "r2" },
    ] as never);
    tx.stockReservation.findUnique
      .mockResolvedValueOnce(null) // r1: NotFoundError
      .mockResolvedValueOnce({
        id: "r2",
        status: "ACTIVE",
        variantId: "variant_1",
        branchId: "branch_1",
        quantity: 1,
      });

    const result = await releaseExpiredReservations(new Date());

    expect(result.releasedCount).toBe(1);
    expect(result.failedReservationIds).toEqual(["r1"]);
  });
});
