/**
 * `/admin/inventory` — docs/09-ADMIN-DAD-MODE.md §6 "Stock management",
 * the dedicated stock screen the product list's inline quick-edit
 * (`admin/product.ts`'s `quickUpdatePrice`/`InlineStockCell`) was always
 * meant to be a smaller, faster sibling of, not a replacement for.
 *
 * Everything here is read-side (`listStockForAdmin`, `getStockHistoryForVariant`)
 * plus one thin write helper (`bulkAdjustStock`) that loops the one real
 * write primitive, `admin/stock.ts`'s `adjustVariantStock` — this file
 * deliberately does not duplicate that primitive's transaction/audit-log
 * logic; every actual stock write in this codebase still goes through
 * exactly one function.
 *
 * SCOPE, same single-default-branch limitation `stock.ts` already
 * documents: this list shows and edits one branch's stock, not a
 * per-branch breakdown.
 *
 * NOT BUILT (flagged, not faked) — the other two docs/09 §6 sub-features:
 * - **Spreadsheet upload** (download a template, upload, preview-before-
 *   apply, background job with a progress bar). Real CSV parsing plus a
 *   background-job runner is a meaningfully separate piece of
 *   infrastructure from the rest of this pass.
 * - **Daily 09:00 NPT low-stock email.** No cron/scheduled-job runner
 *   exists in this codebase yet to trigger it — the dashboard tile and
 *   the "Almost out of stock" filter chip (both already built) are the
 *   low-stock surfacing that exists today.
 */
import "server-only";
import { db } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";
import type { StockMovementReason } from "@/generated/prisma/client";
import type { StockListQuery } from "@/lib/validation/admin/inventory";
import { adjustVariantStock, getDefaultBranchId, getPrimaryStockLevelsByVariantId } from "./stock";
import { listAuditLog } from "./audit-log";
import type { AuditActor } from "./audit-log";

export interface AdminStockRow {
  variantId: string;
  productId: string;
  productName: string;
  productCode: string;
  brandName: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  lowStockThreshold: number;
}

export interface AdminStockListResult {
  items: AdminStockRow[];
  total: number;
  page: number;
  perPage: number;
  hasNext: boolean;
}

const STOCK_LIST_PAGE_SIZE = 24;

/** Same raw-SQL branch-scoped join `admin/product.ts`'s `getProductIdsForStockFilter` uses, at the variant level directly since this screen doesn't need to go through a product id first. */
async function getVariantIdsForStockFilter(
  filter: "low-stock" | "out-of-stock",
): Promise<string[]> {
  const branchId = await getDefaultBranchId();
  if (!branchId) return [];

  const condition =
    filter === "out-of-stock"
      ? Prisma.sql`sl.quantity <= 0`
      : Prisma.sql`sl.quantity <= v.low_stock_threshold`;

  const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT v.id
    FROM variants v
    JOIN stock_levels sl ON sl.variant_id = v.id AND sl.branch_id = ${branchId}
    WHERE v.deleted_at IS NULL AND v.is_active = true AND ${condition}
  `);
  return rows.map((row) => row.id);
}

export async function listStockForAdmin(query: StockListQuery): Promise<AdminStockListResult> {
  const where: Prisma.VariantWhereInput = { isActive: true };

  if (query.q) {
    where.OR = [
      { sku: { contains: query.q, mode: "insensitive" } },
      { product: { name: { contains: query.q, mode: "insensitive" } } },
    ];
  }
  if (query.filter === "low-stock" || query.filter === "out-of-stock") {
    where.id = { in: await getVariantIdsForStockFilter(query.filter) };
  }

  const [variants, total] = await Promise.all([
    db.variant.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * STOCK_LIST_PAGE_SIZE,
      take: STOCK_LIST_PAGE_SIZE,
      include: { product: { include: { brand: { select: { name: true } } } } },
    }),
    db.variant.count({ where }),
  ]);

  const stockByVariantId = await getPrimaryStockLevelsByVariantId(
    variants.map((variant) => variant.id),
  );

  const items: AdminStockRow[] = variants.map((variant) => {
    const level = stockByVariantId.get(variant.id);
    return {
      variantId: variant.id,
      productId: variant.productId,
      productName: variant.product.name,
      productCode: variant.sku,
      brandName: variant.product.brand.name,
      quantity: level?.quantity ?? 0,
      reservedQuantity: level?.reservedQuantity ?? 0,
      availableQuantity: level?.availableQuantity ?? 0,
      lowStockThreshold: variant.lowStockThreshold,
    };
  });

  return {
    items,
    total,
    page: query.page,
    perPage: STOCK_LIST_PAGE_SIZE,
    hasNext: query.page * STOCK_LIST_PAGE_SIZE < total,
  };
}

export interface StockHistoryEntry {
  id: string;
  delta: number;
  /** The quantity the level was set to right after this change — `adjustVariantStock`'s own `AuditLog.after.quantity`, not separately recomputed. */
  quantityAfter: number;
  reason: StockMovementReason;
  reasonLabel: string;
  actorLabel: string;
  createdAt: Date;
}

export interface StockHistoryResult {
  items: StockHistoryEntry[];
  hasNext: boolean;
}

/** docs/09 §2.1's vocabulary table has no direct "StockMovementReason -> plain English" row, so this mirrors `StockAdjuster`'s own five reason labels (the UI this history is the read-side counterpart of), plus the three reasons that primitive doesn't expose (a variant can still accumulate `TRANSFER_IN`/`TRANSFER_OUT`/`INITIAL`/`RESERVATION_RELEASE` movements from other callers). */
const REASON_LABELS: Record<StockMovementReason, string> = {
  PURCHASE: "Received new stock",
  SALE: "Sold in shop",
  RETURN: "Returned",
  DAMAGE: "Damaged",
  CORRECTION: "Correction",
  TRANSFER_IN: "Transferred in",
  TRANSFER_OUT: "Transferred out",
  INITIAL: "Initial stock",
  RESERVATION_RELEASE: "Reservation released",
};

const STOCK_HISTORY_PAGE_SIZE = 25;

/**
 * docs/09 §6 "Stock history": "Per product: a plain-language timeline.
 * '27 Jul, 10:14 — Ramesh added 5 (Received new stock). Now 12.'" Reads
 * straight from the shared `AuditLog` (`audit-log.ts`'s `listAuditLog`,
 * filtered to this variant's `"stock.adjusted"` entries) rather than a
 * bespoke query — `adjustVariantStock` already writes everything this
 * timeline needs (`before.quantity`, `after.quantity`, `after.delta`,
 * `after.reason`) into that one shared log, so there is nothing left for
 * this file to compute a running balance from scratch.
 */
export async function getStockHistoryForVariant(
  variantId: string,
  page = 1,
): Promise<StockHistoryResult> {
  const result = await listAuditLog({
    entityType: "Variant",
    entityId: variantId,
    action: "stock.adjusted",
    page,
    perPage: STOCK_HISTORY_PAGE_SIZE,
  });

  const items: StockHistoryEntry[] = result.items.map((entry) => {
    const after =
      entry.after && typeof entry.after === "object" && !Array.isArray(entry.after)
        ? (entry.after as Record<string, unknown>)
        : {};
    const delta = typeof after.delta === "number" ? after.delta : 0;
    const quantityAfter = typeof after.quantity === "number" ? after.quantity : 0;
    const reason = (
      typeof after.reason === "string" ? after.reason : "CORRECTION"
    ) as StockMovementReason;

    return {
      id: entry.id,
      delta,
      quantityAfter,
      reason,
      // `reason` is read back from this same codebase's own `AuditLog.after`
      // JSON, always originally written by `adjustVariantStock` as a real
      // `StockMovementReason` — not arbitrary/attacker-controlled input,
      // and `REASON_LABELS` is a plain object literal with only its own
      // nine enumerable keys, so an unexpected value here can only ever
      // fall through to the `?? reason` fallback, never reach anything
      // dangerous.
      // eslint-disable-next-line security/detect-object-injection
      reasonLabel: REASON_LABELS[reason] ?? reason,
      actorLabel: entry.actorEmail ?? "Someone",
      createdAt: entry.createdAt,
    };
  });

  return { items, hasNext: result.hasNext };
}

export interface BulkStockAdjustResult {
  updatedCount: number;
  /** Variant ids whose write failed (e.g. a variant deleted between page-load and save) — surfaced so the caller can say exactly what didn't go through, not just a generic partial-failure message. */
  failedVariantIds: string[];
}

/**
 * docs/09 §6 "Bulk update": every row still goes through `adjustVariantStock`
 * one at a time — so "no stock change without a recorded reason" and
 * "every change writes a StockMovement" hold exactly as true for a
 * 50-row bulk save as for a single quick edit. Deliberately not one
 * giant `$transaction`: a single row's failure (e.g. a variant deleted
 * between page-load and save) shouldn't roll back every other row's
 * already-valid change, so each row's write is isolated in its own
 * try/catch instead.
 */
export async function bulkAdjustStock(
  items: { variantId: string; quantity: number }[],
  reason: StockMovementReason,
  note: string | undefined,
  actor: AuditActor,
): Promise<BulkStockAdjustResult> {
  let updatedCount = 0;
  const failedVariantIds: string[] = [];
  for (const item of items) {
    try {
      await adjustVariantStock(item.variantId, item.quantity, reason, actor, note);
      updatedCount += 1;
    } catch {
      failedVariantIds.push(item.variantId);
    }
  }
  return { updatedCount, failedVariantIds };
}
