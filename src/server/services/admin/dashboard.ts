/**
 * The "Today" dashboard — docs/09-ADMIN-DAD-MODE.md §4. "Charts do not
 * answer a shop owner's questions. The dashboard answers them in words
 * and numbers, and charts come further down." This file builds Row 1
 * (four `MetricTile`s) and Row 2 (the "what to do next" task list) —
 * the two rows docs/09 §4 treats as the actual point of the page. Rows
 * 3–5 (this week/month comparisons, top-sellers/recent lists, and the
 * optional collapsible charts) are a deliberately separate, later pass:
 * every number on Row 1/2 answers a "do I need to act right now"
 * question with a single, cheap query; Row 3–5 are retrospective
 * reporting that can layer on top without changing this shape.
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
import { endOfKathmanduDay, startOfKathmanduDay } from "@/lib/date";

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

export interface TodayDashboardData {
  tiles: TodayDashboardTiles;
  tasks: TodayTask[];
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
