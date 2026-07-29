/**
 * The "Today" dashboard — docs/09-ADMIN-DAD-MODE.md §4. "Charts do not
 * answer a shop owner's questions. The dashboard answers them in words
 * and numbers, and charts come further down." This file builds Row 1
 * (four `MetricTile`s), Row 2 (the "what to do next" task list), Row 3
 * (this week/this month, compared like-for-like against the period
 * before), and Row 4 (best sellers, most viewed, recent customers, recent
 * orders). Row 5 (the optional collapsible 30-day charts) is NOT built —
 * docs/17's own Phase 9 acceptance bar explicitly reads "with no chart
 * required," so it's a real, flagged deferral rather than a silent one;
 * every question the dashboard must answer is already covered in words
 * and numbers above it.
 *
 * docs/12-ANALYTICS-MARKETING.md §9's rule — "raw events are rolled up
 * nightly; dashboards query rollups, never raw events" — is honoured two
 * different ways here, deliberately: money/order counts (Rows 1–3) read
 * `Order`/`OrderItem` directly, because those ARE the first-party system
 * of record, not a raw high-volume event stream, and every read is a
 * single indexed range scan (the same "cheap, narrow, independent query"
 * discipline Row 1 already established) — there is no separate
 * `Order` rollup table to build here. "Most viewed products" (Row 4),
 * by contrast, reads the real `ProductViewDaily` rollup table doc 12 §9
 * defines for exactly this — nothing here computes it from raw page-view
 * events. **Flagged, not faked:** nothing in this codebase writes to
 * `ProductViewDaily` yet (product-page view tracking is doc 12/Phase 12
 * scope, not built this pass), so this tile will show its real, honest
 * empty state ("No view data yet") until that instrumentation exists —
 * the query and the table are both genuinely wired, just currently fed
 * by nothing.
 *
 * All money is integer paisa in, integer paisa out — `formatNPR` runs in
 * the page component, never here (`lib/money.ts`'s "formatting happens
 * only at the edge" rule).
 */
import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import {
  OrderPaymentStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
  TicketStatus,
} from "@/generated/prisma/client";
import {
  endOfKathmanduDay,
  formatRelativeTime,
  startOfKathmanduDay,
  startOfKathmanduMonth,
  startOfKathmanduWeek,
} from "@/lib/date";

/** Order statuses that mean "paid, but the shop hasn't shipped it yet" — the middle of the docs/09 §7 status tracker, before `SHIPPED`. */
const AWAITING_SHIPMENT_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.PACKED,
];

/** `Order.paymentStatus` values that count as "money has actually come in" for the "Money today" tile — partial payments count too, at the amount actually received. */
const PAID_STATUSES: OrderPaymentStatus[] = [
  OrderPaymentStatus.PAID,
  OrderPaymentStatus.PARTIALLY_PAID,
];

export interface TodayDashboardTiles {
  ordersToday: number;
  ordersTodayHelper: string;
  moneyTodayPaisa: number;
  moneyYesterdayPaisa: number;
  /** "2 payments to check · 3 orders to send" style composite — the sum of every Row 2 task, not an independent count. */
  needsAttentionCount: number;
  needsAttentionHelper: string;
  almostOutOfStockCount: number;
}

export interface TodayTask {
  id: string;
  /** e.g. "2 bank transfer payments waiting for you to check". */
  label: string;
  /** e.g. "Review", "See orders" — the button text, docs/09 §4 Row 2. */
  actionLabel: string;
  href: string;
  count: number;
}

/**
 * Row 3 — "This week"/"This month", each compared against the same
 * number of days from the period immediately before it (not the whole
 * prior period), so a Wednesday reading never gets unfairly compared
 * against a full 7-day prior week — that would always read as a
 * misleadingly large "down" swing early in the week.
 */
export interface PeriodTrend {
  label: string;
  ordersCount: number;
  revenuePaisa: number;
  aovPaisa: number;
  comparisonLabel: string;
  trendDirection: "up" | "down" | null;
  href: string;
}

/** One row of Row 4's four lists. `amountPaisa`, when present, is formatted by the page (`formatNPR`) — never here. */
export interface DashboardListItem {
  id: string;
  primaryLabel: string;
  secondaryLabel: string;
  amountPaisa?: number;
  href: string;
}

export interface TodayDashboardData {
  tiles: TodayDashboardTiles;
  tasks: TodayTask[];
  trends: {
    thisWeek: PeriodTrend;
    thisMonth: PeriodTrend;
  };
  lists: {
    bestSellers: DashboardListItem[];
    mostViewed: DashboardListItem[];
    recentCustomers: DashboardListItem[];
    recentOrders: DashboardListItem[];
  };
}

interface LowStockCountRow {
  count: bigint;
}

/**
 * "Almost out of stock" compares two columns on two different rows
 * (`StockLevel.quantity` against its own variant's `Variant.
 * lowStockThreshold`) — Prisma's `where` filter cannot express a
 * field-to-field comparison, so this is one of the handful of places in
 * the codebase (alongside `catalog/search.ts`'s ranked full-text query)
 * that drops to `$queryRaw`. Counts distinct variants, not stock rows —
 * a variant low in two branches should still only count once on this
 * tile, matching "7 products are almost out of stock" reading as a
 * product count, not a branch-row count.
 */
async function countVariantsLowOnStock(): Promise<number> {
  const rows = await db.$queryRaw<LowStockCountRow[]>`
    SELECT COUNT(DISTINCT sl.variant_id)::bigint AS count
    FROM stock_levels sl
    JOIN variants v ON v.id = sl.variant_id
    WHERE v.deleted_at IS NULL
      AND v.is_active = true
      AND sl.quantity <= v.low_stock_threshold
  `;
  return Number(rows[0]?.count ?? 0n);
}

/** Products with at least one gallery photo already attached, per `ProductMedia` — the inverse (`hasNoPhoto`) is what docs/09 §4's "2 products have no photo" task needs. */
async function countActiveProductsWithNoPhoto(): Promise<number> {
  return db.product.count({
    where: {
      status: "ACTIVE",
      media: { none: {} },
    },
  });
}

/** "Bank transfer payments waiting for you to check" — docs/09 §4 Row 2, §7's payment panel: a receipt has been uploaded but nobody has approved or rejected it yet. */
async function countPendingBankTransferReceipts(): Promise<number> {
  return db.payment.count({
    where: {
      provider: PaymentProvider.BANK_TRANSFER,
      status: PaymentStatus.PENDING,
      receiptMediaId: { not: null },
      approvedAt: null,
    },
  });
}

async function countOrdersPaidNotYetSent(): Promise<number> {
  return db.order.count({
    where: {
      paymentStatus: OrderPaymentStatus.PAID,
      status: { in: AWAITING_SHIPMENT_STATUSES },
    },
  });
}

async function countUnreadEnquiries(): Promise<number> {
  return db.enquiry.count({ where: { status: "UNREAD" } });
}

async function countTicketsReadyForPickup(): Promise<number> {
  return db.serviceTicket.count({ where: { status: TicketStatus.READY_FOR_PICKUP } });
}

/**
 * Turns a current/previous paisa pair into the plain-language comparison
 * docs/09 §2 asks for ("up 12%", never a bare number or a coloured arrow
 * with no words). A previous period with nothing in it is a real,
 * distinct case, not a divide-by-zero to hide — "more than before" and
 * "the same as before" are both honestly worded rather than a fake "up
 * ∞%" or a silently-skipped tile.
 */
export function formatPeriodComparison(
  currentPaisa: number,
  previousPaisa: number,
): { label: string; direction: "up" | "down" | null } {
  if (previousPaisa <= 0) {
    return currentPaisa > 0
      ? { label: "more than the period before (which had none)", direction: "up" }
      : { label: "the same as the period before", direction: null };
  }
  const percent = Math.round(((currentPaisa - previousPaisa) / previousPaisa) * 100);
  if (percent === 0) return { label: "about the same as the period before", direction: null };
  return percent > 0
    ? { label: `up ${percent}% from the period before`, direction: "up" }
    : { label: `down ${Math.abs(percent)}% from the period before`, direction: "down" };
}

/** "CONFIRMED" -> "Confirmed", "PENDING_PAYMENT" -> "Pending payment" — same small transform `/admin/orders`'s own list page already uses locally, duplicated here rather than shared per this codebase's own precedent (see `orders.ts`'s doc comment) for keeping a Row-4 preview list decoupled from the full order-list page. */
function titleCaseStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** Same-length, immediately-preceding window: e.g. "this week so far" (Mon 00:00 -> now) compared against "last week, the same number of days in" (last Mon 00:00 -> last Mon + that many days). */
function likeForLikePriorRange(periodStart: Date, priorPeriodStart: Date, now: Date) {
  const elapsedMs = now.getTime() - periodStart.getTime();
  return { start: priorPeriodStart, end: new Date(priorPeriodStart.getTime() + elapsedMs) };
}

async function getPeriodTrend(
  label: string,
  periodStart: Date,
  priorPeriodStart: Date,
  now: Date,
  href: string,
): Promise<PeriodTrend> {
  const prior = likeForLikePriorRange(periodStart, priorPeriodStart, now);

  const [currentAgg, currentCount, priorAgg, priorCount] = await Promise.all([
    db.order.aggregate({
      _sum: { paidPaisa: true },
      where: { placedAt: { gte: periodStart, lte: now }, paymentStatus: { in: PAID_STATUSES } },
    }),
    db.order.count({ where: { placedAt: { gte: periodStart, lte: now } } }),
    db.order.aggregate({
      _sum: { paidPaisa: true },
      where: {
        placedAt: { gte: prior.start, lte: prior.end },
        paymentStatus: { in: PAID_STATUSES },
      },
    }),
    db.order.count({ where: { placedAt: { gte: prior.start, lte: prior.end } } }),
  ]);
  void priorCount;

  const revenuePaisa = currentAgg._sum.paidPaisa ?? 0;
  const priorRevenuePaisa = priorAgg._sum.paidPaisa ?? 0;
  const comparison = formatPeriodComparison(revenuePaisa, priorRevenuePaisa);

  return {
    label,
    ordersCount: currentCount,
    revenuePaisa,
    aovPaisa: currentCount > 0 ? Math.round(revenuePaisa / currentCount) : 0,
    comparisonLabel: comparison.label,
    trendDirection: comparison.direction,
    href,
  };
}

/** Orders that should never count toward "best sellers" — money that never actually changed hands. */
const EXCLUDED_FROM_SALES_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.PAYMENT_FAILED,
];

/** Row 4, "Best sellers this week" — summed `OrderItem.quantity` over the last 7 days, grouped by variant, then resolved to the parent product for display/link. A real, bounded (one week) aggregation over the actual sales ledger, not a guess. */
async function listBestSellers(sevenDaysAgo: Date, now: Date): Promise<DashboardListItem[]> {
  const rows = await db.orderItem.groupBy({
    by: ["variantId"],
    where: {
      variantId: { not: null },
      order: {
        placedAt: { gte: sevenDaysAgo, lte: now },
        status: { notIn: EXCLUDED_FROM_SALES_STATUSES },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: 5,
  });
  const variantIds = rows.map((row) => row.variantId).filter((id): id is string => id !== null);
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
      const qty = row._sum.quantity ?? 0;
      return {
        id: product.id,
        primaryLabel: product.name,
        secondaryLabel: `${qty} sold this week`,
        href: `/admin/products/${product.id}/edit`,
      } satisfies DashboardListItem;
    })
    .filter((item): item is DashboardListItem => item !== null);
}

/** Row 4, "Most viewed this week" — reads the `ProductViewDaily` rollup table (doc 12 §9), never raw page-view events. Returns `[]` (a real, honest empty state) until something writes to that table — see this file's own top-of-file note. */
async function listMostViewed(sevenDaysAgo: Date): Promise<DashboardListItem[]> {
  const rows = await db.productViewDaily.groupBy({
    by: ["productId"],
    where: { date: { gte: startOfKathmanduDay(sevenDaysAgo) } },
    _sum: { views: true },
    orderBy: { _sum: { views: "desc" } },
    take: 5,
  });
  if (rows.length === 0) return [];

  const products = await db.product.findMany({
    where: { id: { in: rows.map((row) => row.productId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(products.map((p) => [p.id, p.name]));

  return rows
    .map((row) => {
      const name = nameById.get(row.productId);
      if (!name) return null;
      return {
        id: row.productId,
        primaryLabel: name,
        secondaryLabel: `${row._sum.views ?? 0} views this week`,
        href: `/admin/products/${row.productId}/edit`,
      } satisfies DashboardListItem;
    })
    .filter((item): item is DashboardListItem => item !== null);
}

async function listRecentCustomers(now: Date): Promise<DashboardListItem[]> {
  const customers = await db.customer.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, name: true, phone: true, email: true, createdAt: true },
  });
  return customers.map((customer) => ({
    id: customer.id,
    primaryLabel: customer.name ?? customer.phone ?? customer.email ?? "Customer",
    secondaryLabel: `Joined ${formatRelativeTime(customer.createdAt, now)}`,
    href: `/admin/customers/${customer.id}`,
  }));
}

async function listRecentOrders(): Promise<DashboardListItem[]> {
  const orders = await db.order.findMany({
    orderBy: { placedAt: "desc" },
    take: 5,
    select: { id: true, orderNumber: true, status: true, totalPaisa: true },
  });
  return orders.map((order) => ({
    id: order.id,
    primaryLabel: order.orderNumber,
    secondaryLabel: titleCaseStatus(order.status),
    amountPaisa: order.totalPaisa,
    href: `/admin/orders/${order.id}`,
  }));
}

/**
 * The full Today page in one call — every count below is deliberately a
 * separate, narrow query rather than one giant join, so a slow query on
 * one tile can't block the rest of the page and each count independently
 * matches the exact business question docs/09 §4 poses for it.
 */
export async function getTodayDashboard(now: Date = new Date()): Promise<TodayDashboardData> {
  const todayStart = startOfKathmanduDay(now);
  const todayEnd = endOfKathmanduDay(now);
  const yesterday = new Date(todayStart.getTime() - 1);
  const yesterdayStart = startOfKathmanduDay(yesterday);
  const yesterdayEnd = endOfKathmanduDay(yesterday);

  const [
    ordersToday,
    moneyTodayAgg,
    moneyYesterdayAgg,
    pendingBankTransfers,
    ordersPaidNotSent,
    almostOutOfStockCount,
    noPhotoCount,
    unreadEnquiries,
    ticketsReadyForPickup,
  ] = await Promise.all([
    db.order.count({ where: { placedAt: { gte: todayStart, lte: todayEnd } } }),
    db.order.aggregate({
      _sum: { paidPaisa: true },
      where: {
        placedAt: { gte: todayStart, lte: todayEnd },
        paymentStatus: { in: PAID_STATUSES },
      },
    }),
    db.order.aggregate({
      _sum: { paidPaisa: true },
      where: {
        placedAt: { gte: yesterdayStart, lte: yesterdayEnd },
        paymentStatus: { in: PAID_STATUSES },
      },
    }),
    countPendingBankTransferReceipts(),
    countOrdersPaidNotYetSent(),
    countVariantsLowOnStock(),
    countActiveProductsWithNoPhoto(),
    countUnreadEnquiries(),
    countTicketsReadyForPickup(),
  ]);

  const weekStart = startOfKathmanduWeek(now);
  const priorWeekStart = new Date(weekStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = startOfKathmanduMonth(now);
  const priorMonthStart = startOfKathmanduMonth(new Date(monthStart.getTime() - 1));
  const sevenDaysAgo = new Date(todayStart.getTime() - 6 * 24 * 60 * 60 * 1000);

  const [thisWeek, thisMonth, bestSellers, mostViewed, recentCustomers, recentOrders] =
    await Promise.all([
      getPeriodTrend("This week", weekStart, priorWeekStart, now, "/admin/orders"),
      getPeriodTrend("This month", monthStart, priorMonthStart, now, "/admin/orders"),
      listBestSellers(sevenDaysAgo, now),
      listMostViewed(sevenDaysAgo),
      listRecentCustomers(now),
      listRecentOrders(),
    ]);

  const ordersNeedingAttention = pendingBankTransfers + ordersPaidNotSent;

  const tasks: TodayTask[] = [
    {
      id: "bank-transfers",
      label: `${pendingBankTransfers} bank transfer payment${pendingBankTransfers === 1 ? "" : "s"} waiting for you to check`,
      actionLabel: "Review",
      href: "/admin/orders?paymentMethod=bank_transfer&needsReview=true",
      count: pendingBankTransfers,
    },
    {
      id: "paid-not-sent",
      label: `${ordersPaidNotSent} order${ordersPaidNotSent === 1 ? " is" : "s are"} paid but not sent yet`,
      actionLabel: "See orders",
      href: "/admin/orders?filter=paid-not-sent",
      count: ordersPaidNotSent,
    },
    {
      id: "low-stock",
      label: `${almostOutOfStockCount} product${almostOutOfStockCount === 1 ? " is" : "s are"} almost out of stock`,
      actionLabel: "See list",
      href: "/admin/inventory?filter=low-stock",
      count: almostOutOfStockCount,
    },
    {
      id: "no-photo",
      label: `${noPhotoCount} product${noPhotoCount === 1 ? " has" : "s have"} no photo`,
      actionLabel: "Fix",
      href: "/admin/products?filter=no-photo",
      count: noPhotoCount,
    },
    {
      id: "unread-messages",
      label: `${unreadEnquiries} customer message${unreadEnquiries === 1 ? "" : "s"} you haven't read`,
      actionLabel: "Read",
      href: "/admin/enquiries?filter=unread",
      count: unreadEnquiries,
    },
    {
      id: "ready-for-pickup",
      label: `${ticketsReadyForPickup} repair job${ticketsReadyForPickup === 1 ? " is" : "s are"} ready for pickup`,
      actionLabel: "See job",
      href: "/admin/service?filter=ready-for-pickup",
      count: ticketsReadyForPickup,
    },
  ].filter((task) => task.count > 0);

  const moneyTodayPaisa = moneyTodayAgg._sum.paidPaisa ?? 0;
  const moneyYesterdayPaisa = moneyYesterdayAgg._sum.paidPaisa ?? 0;

  return {
    tiles: {
      ordersToday,
      ordersTodayHelper:
        ordersNeedingAttention > 0
          ? `${ordersNeedingAttention} still need${ordersNeedingAttention === 1 ? "s" : ""} attention`
          : "All caught up",
      moneyTodayPaisa,
      moneyYesterdayPaisa,
      needsAttentionCount: ordersNeedingAttention,
      needsAttentionHelper:
        ordersNeedingAttention > 0
          ? [
              pendingBankTransfers > 0
                ? `${pendingBankTransfers} payment${pendingBankTransfers === 1 ? "" : "s"} to check`
                : null,
              ordersPaidNotSent > 0
                ? `${ordersPaidNotSent} order${ordersPaidNotSent === 1 ? "" : "s"} to send`
                : null,
            ]
              .filter(Boolean)
              .join(" · ")
          : "Nothing needs your attention right now",
      almostOutOfStockCount,
    },
    tasks,
    trends: { thisWeek, thisMonth },
    lists: { bestSellers, mostViewed, recentCustomers, recentOrders },
  };
}

/**
 * Per-request memoised wrapper (React `cache()`, App Router's documented
 * dedup mechanism for Server Components) — `(admin)/layout.tsx` needs the
 * task counts for the sidebar's badges on every single admin page, and
 * `(admin)/admin/page.tsx` needs the exact same data for the dashboard
 * body. Without this, every admin page load would run the full set of
 * dashboard queries twice: once for the layout's badges, once for the
 * page. Deliberately zero-argument (rather than forwarding a `now`) so
 * every call within one request lands on the same cache entry — two
 * `new Date()` instances a few milliseconds apart would otherwise be
 * `Object.is`-distinct and defeat the memoisation entirely.
 */
export const getTodayDashboardForRequest = cache(() => getTodayDashboard());
