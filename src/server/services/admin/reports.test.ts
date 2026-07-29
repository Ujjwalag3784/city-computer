import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  db: {
    order: { aggregate: vi.fn(), count: vi.fn() },
    orderItem: { groupBy: vi.fn() },
    variant: { findMany: vi.fn() },
    searchQueryLog: { groupBy: vi.fn() },
  },
}));

vi.mock("./inventory", () => ({
  listStockForAdmin: vi.fn(),
}));

const { db } = await import("@/server/db");
const { listStockForAdmin } = await import("./inventory");
const { getSalesReport, getTopProductsReport, getInventoryReport, getSearchGapsReport } =
  await import("./reports");

beforeEach(() => {
  vi.mocked(db.order.aggregate).mockReset();
  vi.mocked(db.order.count).mockReset();
  vi.mocked(db.orderItem.groupBy).mockReset();
  vi.mocked(db.variant.findMany).mockReset();
  vi.mocked(db.searchQueryLog.groupBy).mockReset();
  vi.mocked(listStockForAdmin).mockReset();
});

describe("getSalesReport", () => {
  it("computes AOV as revenue divided by order count", async () => {
    vi.mocked(db.order.aggregate).mockResolvedValue({ _sum: { paidPaisa: 100_000 } } as never);
    vi.mocked(db.order.count).mockResolvedValueOnce(4).mockResolvedValueOnce(0);

    const report = await getSalesReport("7d", new Date("2026-07-29T00:00:00Z"));

    expect(report.ordersCount).toBe(4);
    expect(report.revenuePaisa).toBe(100_000);
    expect(report.aovPaisa).toBe(25_000);
  });

  it("reports zero AOV when there are no orders", async () => {
    vi.mocked(db.order.aggregate).mockResolvedValue({ _sum: { paidPaisa: null } } as never);
    vi.mocked(db.order.count).mockResolvedValue(0);

    const report = await getSalesReport("today");

    expect(report.aovPaisa).toBe(0);
  });
});

describe("getTopProductsReport", () => {
  it("returns an empty list when nothing sold in the range", async () => {
    vi.mocked(db.orderItem.groupBy).mockResolvedValue([]);

    const result = await getTopProductsReport("7d");

    expect(result).toEqual([]);
    expect(db.variant.findMany).not.toHaveBeenCalled();
  });

  it("resolves variant ids to their parent product", async () => {
    vi.mocked(db.orderItem.groupBy).mockResolvedValue([
      { variantId: "v1", _sum: { quantity: 5, lineTotalPaisa: 50_000 } },
    ] as never);
    vi.mocked(db.variant.findMany).mockResolvedValue([
      { id: "v1", product: { id: "p1", name: "HP Victus 15" } },
    ] as never);

    const result = await getTopProductsReport("7d");

    expect(result).toEqual([
      { productId: "p1", productName: "HP Victus 15", quantitySold: 5, revenuePaisa: 50_000 },
    ]);
  });
});

describe("getInventoryReport", () => {
  it("reports low-stock and out-of-stock counts from listStockForAdmin", async () => {
    vi.mocked(listStockForAdmin)
      .mockResolvedValueOnce({
        items: [{ productName: "Logitech G102", quantity: 1, lowStockThreshold: 3 } as never],
        total: 7,
        page: 1,
        perPage: 24,
        hasNext: false,
      })
      .mockResolvedValueOnce({ items: [], total: 2, page: 1, perPage: 24, hasNext: false });

    const report = await getInventoryReport();

    expect(report.lowStockCount).toBe(7);
    expect(report.outOfStockCount).toBe(2);
    expect(report.topLowStock).toHaveLength(1);
  });
});

describe("getSearchGapsReport", () => {
  it("maps grouped rows to query/count/lastSearchedAt", async () => {
    vi.mocked(db.searchQueryLog.groupBy).mockResolvedValue([
      {
        normalisedQuery: "rtx 5090",
        _count: { _all: 12 },
        _max: { createdAt: new Date("2026-07-20") },
      },
    ] as never);

    const result = await getSearchGapsReport(new Date("2026-07-29T00:00:00Z"));

    expect(result).toEqual([
      { query: "rtx 5090", searchCount: 12, lastSearchedAt: new Date("2026-07-20") },
    ]);
  });
});
