/**
 * `/admin/reports` — docs/09-ADMIN-DAD-MODE.md §3 ("Reports" — OWNER,
 * MANAGER) and docs/17-ROADMAP-PHASES.md Phase 9's "sales, products,
 * inventory, search gaps" deliverable list.
 *
 * Sales/products read `Order`/`OrderItem` directly — first-party system
 * of record, same "single indexed range scan, no rollup table needed"
 * reasoning `admin/dashboard.ts`'s own top-of-file note gives for its
 * Rows 1–3. Inventory reuses `admin/inventory.ts`'s existing
 * `listStockForAdmin` rather than re-querying stock levels a second way.
 * Search gaps reads the real `SearchQueryLog` table — `catalog/search.ts`
 * has written to it unconditionally (including zero-result searches)
 * since Phase 4, so this is genuine usage data, not a stub.
 */
import "server-only";
import { db } from "@/server/db";
import { OrderPaymentStatus, OrderStatus } from "@/generated/prisma/client";
import { startOfKathmanduDay, startOfKathmanduMonth } from "@/lib/date";
import { listStockForAdmin } from "@/server/services/admin/inventory";

export type ReportRange = "today" | "7d" | "30d" | "month";

const PAID_STATUSES: OrderPaymentStatus[] = [
  OrderPaymentStatus.PAID,
  OrderPaymentStatus.PARTIALLY_PAID,
];

const EXCLUDED_FROM_SALES_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.PAYMENT_FAILED,
];

export const REPORT_RANGE_OPTIONS: { value: ReportRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "month", label: "This month" },
];

function rangeStart(range: ReportRange, now: Date): Date {
  if (range === "today") return startOfKathmanduDay(now);
  if (range === "7d") return new Date(startOfKathmanduDay(now).getTime() - 6 * 24 * 60 * 60 * 1000);
  if (range === "30d")
    return new Date(startOfKathmanduDay(now).getTime() - 29 * 24 * 60 * 60 * 1000);
  return startOfKathmanduMonth(now);
}

export interface SalesReport {
  rangeLabel: string;
  ordersCount: number;
  revenuePaisa: number;
  aovPaisa: number;
  cancelledCount: number;
}

export async function getSalesReport(
  range: ReportRange,
  now: Date = new Date(),
): Promise<SalesReport> {
  const start = rangeStart(range, now);
  const [agg, count, cancelledCount] = await Promise.all([
    db.order.aggregate({
      _sum: { paidPaisa: true },
      where: { placedAt: { gte: start, lte: now }, paymentStatus: { in: PAID_STATUSES } },
    }),
    db.order.count({ where: { placedAt: { gte: start, lte: now } } }),
    db.order.count({
      where: { placedAt: { gte: start, lte: now }, status: OrderStatus.CANCELLED },
    }),
  ]);
  const revenuePaisa = agg._sum.paidPaisa ?? 0;
  return {
    rangeLabel: REPORT_RANGE_OPTIONS.find((o) => o.value === range)?.label ?? range,
    ordersCount: count,
    revenuePaisa,
    aovPaisa: count > 0 ? Math.round(revenuePaisa / count) : 0,
    cancelledCount,
  };
}

export interface ProductReportRow {
  productId: string;
  productName: string;
  quantitySold: number;
  revenuePaisa: number;
}

/** Top sellers by quantity, ranked over `range` — the same shape as `dashboard.ts`'s `listBestSellers` but with a configurable window and revenue attached, since a report (unlike a dashboard tile) has room for both numbers. */
export async function getTopProductsReport(
  range: ReportRange,
  now: Date = new Date(),
  limit = 10,
): Promise<ProductReportRow[]> {
  const start = rangeStart(range, now);
  const rows = await db.orderItem.groupBy({
    by: ["variantId"],
    where: {
      variantId: { not: null },
      order: {
        placedAt: { gte: start, lte: now },
        status: { notIn: EXCLUDED_FROM_SALES_STATUSES },
      },
    },
    _sum: { quantity: true, lineTotalPaisa: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit,
  });
  const variantIds = rows.map((r) => r.variantId).filter((id): id is string => id !== null);
  if (variantIds.length === 0) return [];

  const variants = await db.variant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, product: { select: { id: true, name: true } } },
  });
  const productByVariantId = new Map(variants.map((v) => [v.id, v.product]));

  return rows
    .map((row) => {
      const product = row.variantId ? productByVariantId.get(row.variantId) : null;
      if (!product) return null;
      return {
        productId: product.id,
        productName: product.name,
        quantitySold: row._sum.quantity ?? 0,
        revenuePaisa: row._sum.lineTotalPaisa ?? 0,
      } satisfies ProductReportRow;
    })
    .filter((row): row is ProductReportRow => row !== null);
}

export interface InventoryReportSummary {
  lowStockCount: number;
  outOfStockCount: number;
  topLowStock: { productName: string; quantity: number; lowStockThreshold: number }[];
}

export async function getInventoryReport(): Promise<InventoryReportSummary> {
  const [lowStock, outOfStock] = await Promise.all([
    listStockForAdmin({ filter: "low-stock", page: 1 }),
    listStockForAdmin({ filter: "out-of-stock", page: 1 }),
  ]);
  return {
    lowStockCount: lowStock.total,
    outOfStockCount: outOfStock.total,
    topLowStock: lowStock.items.slice(0, 10).map((item) => ({
      productName: item.productName,
      quantity: item.quantity,
      lowStockThreshold: item.lowStockThreshold,
    })),
  };
}

export interface SearchGapRow {
  query: string;
  searchCount: number;
  lastSearchedAt: Date;
}

/** docs/12-ANALYTICS-MARKETING.md §12: "What people searched for and didn't find... you might want to stock these" — grouped by the normalised query over the last 30 days, most frequent first. Real data: see this file's own top-of-file note. */
export async function getSearchGapsReport(
  now: Date = new Date(),
  days = 30,
): Promise<SearchGapRow[]> {
  const since = new Date(startOfKathmanduDay(now).getTime() - (days - 1) * 24 * 60 * 60 * 1000);
  const rows = await db.searchQueryLog.groupBy({
    by: ["normalisedQuery"],
    where: { hasResults: false, createdAt: { gte: since } },
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: { _count: { normalisedQuery: "desc" } },
    take: 20,
  });
  return rows.map((row) => ({
    query: row.normalisedQuery,
    searchCount: row._count._all,
    lastSearchedAt: row._max.createdAt ?? since,
  }));
}
