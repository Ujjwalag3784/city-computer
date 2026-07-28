/**
 * `StockReservation` service — docs/06-DATA-MODEL.md §5 and
 * docs/17-ROADMAP-PHASES.md Phase 6's defining risk: "Overselling under
 * concurrency (high)."
 *
 * WHEN THIS RUNS (docs/06 §5, verbatim): "Reserved on order placement, not
 * add-to-cart (avoids denial-of-inventory abuse)." Nothing in
 * `commerce/cart.ts` calls this file — adding to cart only checks
 * available stock, it never holds it. This service's real caller is order
 * placement, and **this codebase has no checkout/order-placement screen
 * yet** (that's a later phase's job per docs/17). This file is therefore
 * real, correct, unit-tested logic that is deliberately not wired into any
 * live route today — flagged here rather than silently left unbuilt, and
 * flagged again in PROGRESS.md, per this project's own "flag rather than
 * fake" convention.
 *
 * THE CONCURRENCY-SAFE PART: `reserveStock` cannot use a
 * read-quantity-then-write pattern (`SELECT ... ` followed by an `UPDATE`)
 * without `SELECT ... FOR UPDATE`, because two concurrent requests could
 * both read "2 available" and both then write a reservation for the last
 * unit. Prisma's typed `where` filters can't express a field-to-field
 * comparison like `quantity - reservedQuantity >= $n` (that needs SQL, not
 * the query builder), so the guard is one atomic `UPDATE ... WHERE
 * quantity - reserved_quantity >= $n` via `$executeRaw` — the database
 * itself refuses the write if the guard fails, with no separate read step
 * for another request to race against. `reserveStock`'s own unit tests
 * assert on the raw-SQL guard's row count, not on a mocked read+write.
 */
import "server-only";
import { db } from "@/server/db";
import { StockReservationStatus, StockMovementReason } from "@/generated/prisma/client";
import type { StockReservation } from "@/generated/prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";

export type ReservationPaymentMethod = "WALLET" | "BANK_TRANSFER" | "COD";

/** docs/06 §5: "TTL by payment method: 30 min for wallet redirects, 24 h for bank transfer, immediate consume for COD." COD has no TTL because it is never held as a reservation at all — see `reserveForOrder`'s doc comment. */
export function reservationTtlMs(method: ReservationPaymentMethod): number {
  switch (method) {
    case "WALLET":
      return 30 * 60 * 1000;
    case "BANK_TRANSFER":
      return 24 * 60 * 60 * 1000;
    case "COD":
      return 0;
  }
}

export interface ReserveStockItem {
  variantId: string;
  branchId: string;
  quantity: number;
}

/**
 * Atomically increments `StockLevel.reservedQuantity` for every item in
 * one transaction, guarded so it can never push `reservedQuantity` past
 * `quantity` (unless the variant allows backorder, checked by the caller —
 * this function trusts `allowBackorder` was already resolved into
 * `allowBackorderVariantIds`, it does not re-query `Variant` itself, to
 * keep the hot path to exactly one guarded statement per item plus one
 * insert). If *any* item in the batch can't be reserved, the whole
 * transaction rolls back — a partial reservation across a multi-item order
 * would be worse than failing the whole thing atomically.
 */
export async function reserveStock(
  items: ReserveStockItem[],
  options: {
    cartId?: string;
    orderId?: string;
    expiresAt: Date;
    allowBackorderVariantIds?: Set<string>;
  },
): Promise<StockReservation[]> {
  if (items.length === 0) return [];
  const allowBackorder = options.allowBackorderVariantIds ?? new Set<string>();

  return db.$transaction(async (tx) => {
    const reservations: StockReservation[] = [];
    for (const item of items) {
      if (!allowBackorder.has(item.variantId)) {
        const affectedRows = await tx.$executeRaw`
          UPDATE stock_levels
          SET reserved_quantity = reserved_quantity + ${item.quantity}
          WHERE variant_id = ${item.variantId}
            AND branch_id = ${item.branchId}
            AND quantity - reserved_quantity >= ${item.quantity}
        `;
        if (affectedRows !== 1) {
          throw new AppError(
            "INSUFFICIENT_STOCK",
            "One or more items sold out while this order was being placed.",
          );
        }
      } else {
        // Backorder-eligible: still track the reservation for reporting,
        // but the guard above would incorrectly block it, so this is a
        // plain unconditional increment instead.
        await tx.stockLevel.updateMany({
          where: { variantId: item.variantId, branchId: item.branchId },
          data: { reservedQuantity: { increment: item.quantity } },
        });
      }

      const reservation = await tx.stockReservation.create({
        data: {
          variantId: item.variantId,
          branchId: item.branchId,
          quantity: item.quantity,
          cartId: options.cartId,
          orderId: options.orderId,
          expiresAt: options.expiresAt,
          status: StockReservationStatus.ACTIVE,
        },
      });
      reservations.push(reservation);
    }
    return reservations;
  });
}

/**
 * The "commit" step: physical stock actually leaves the building.
 * Decrements both `quantity` and `reservedQuantity` by the reservation's
 * amount, writes the matching signed `StockMovement` (reason `SALE`,
 * `referenceType: "Order"`), and marks the reservation `CONSUMED` — all in
 * one transaction, so `StockLevel.quantity` and the append-only
 * `StockMovement` ledger can never disagree.
 */
export async function consumeReservation(
  reservationId: string,
  actorId: string | null = null,
): Promise<void> {
  await db.$transaction(async (tx) => {
    const reservation = await tx.stockReservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundError("Stock reservation");
    if (reservation.status !== StockReservationStatus.ACTIVE) {
      throw new AppError("CONFLICT_VERSION", "This reservation is no longer active.");
    }

    await tx.stockLevel.updateMany({
      where: { variantId: reservation.variantId, branchId: reservation.branchId },
      data: {
        quantity: { decrement: reservation.quantity },
        reservedQuantity: { decrement: reservation.quantity },
      },
    });
    await tx.stockMovement.create({
      data: {
        variantId: reservation.variantId,
        branchId: reservation.branchId,
        delta: -reservation.quantity,
        reason: StockMovementReason.SALE,
        referenceType: "Order",
        referenceId: reservation.orderId,
        actorId,
      },
    });
    await tx.stockReservation.update({
      where: { id: reservationId },
      data: { status: StockReservationStatus.CONSUMED },
    });
  });
}

/**
 * Gives the held stock back without ever having sold it: decrements only
 * `reservedQuantity` (physical `quantity` never moved), writes a `delta:
 * 0` `RESERVATION_RELEASE` `StockMovement` — a real ledger entry so the
 * release is auditable, even though it moves no physical stock — and sets
 * the reservation's status to whichever terminal state the caller names
 * (`RELEASED` for a cancelled order, `EXPIRED` for the sweep job below).
 */
export async function releaseReservation(
  reservationId: string,
  toStatus: "RELEASED" | "EXPIRED" = "RELEASED",
): Promise<void> {
  await db.$transaction(async (tx) => {
    const reservation = await tx.stockReservation.findUnique({ where: { id: reservationId } });
    if (!reservation) throw new NotFoundError("Stock reservation");
    if (reservation.status !== StockReservationStatus.ACTIVE) return; // already released/expired/consumed — no-op, not an error.

    await tx.stockLevel.updateMany({
      where: { variantId: reservation.variantId, branchId: reservation.branchId },
      data: { reservedQuantity: { decrement: reservation.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        variantId: reservation.variantId,
        branchId: reservation.branchId,
        delta: 0,
        reason: StockMovementReason.RESERVATION_RELEASE,
        referenceType: "StockReservation",
        referenceId: reservation.id,
      },
    });
    await tx.stockReservation.update({
      where: { id: reservationId },
      data: {
        status:
          toStatus === "RELEASED"
            ? StockReservationStatus.RELEASED
            : StockReservationStatus.EXPIRED,
      },
    });
  });
}

export interface ReleaseExpiredReservationsResult {
  releasedCount: number;
  failedReservationIds: string[];
}

/**
 * The sweep job docs/06 §5 calls for: "A job releases expired reservations
 * and writes `RESERVATION_RELEASE` movements." Not wired to any
 * cron/scheduler in this codebase yet (no job runner exists) — this
 * function is the real logic a future scheduled task should call, same
 * "flag rather than fake" as this file's header comment. Capped at 500 per
 * call so a real cron invocation can't accidentally try to process an
 * unbounded backlog in one transaction-per-row loop.
 */
export async function releaseExpiredReservations(
  now: Date = new Date(),
): Promise<ReleaseExpiredReservationsResult> {
  const expired = await db.stockReservation.findMany({
    where: { status: StockReservationStatus.ACTIVE, expiresAt: { lt: now } },
    take: 500,
    select: { id: true },
  });

  let releasedCount = 0;
  const failedReservationIds: string[] = [];
  for (const reservation of expired) {
    try {
      await releaseReservation(reservation.id, "EXPIRED");
      releasedCount += 1;
    } catch {
      failedReservationIds.push(reservation.id);
    }
  }
  return { releasedCount, failedReservationIds };
}
