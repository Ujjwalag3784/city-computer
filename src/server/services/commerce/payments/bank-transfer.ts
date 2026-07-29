/**
 * Bank transfer with receipt upload — docs/10-PAYMENTS-NEPAL.md §8: "The
 * realistic high-value fallback, and the highest-fraud-risk flow in the
 * system. A receipt image is a claim, not a payment."
 *
 * BUILT THIS PASS: creating the `Payment` row, attaching an uploaded
 * receipt, the two-person approval threshold check, and approve/reject
 * with stock consumption/release.
 *
 * NOT BUILT, flagged rather than faked:
 * - **Magic-byte sniffing, EXIF stripping, and re-encoding** of the
 *   uploaded receipt — this pass reuses the existing product-media
 *   upload primitive's validation (MIME/size from the client-declared
 *   content type, checked against `RequestUploadInput`'s schema), which
 *   itself doesn't do magic-byte sniffing yet either (see
 *   `admin/media.ts`'s own scope). A receipt is stored privately (no
 *   public URL is ever constructed for it — see `receipt-upload.ts`)
 *   but the deeper file-safety hardening docs/10 §8 asks for is a
 *   separate piece of work.
 * - **OCR pre-fill of amount/reference.** Never auto-approve on it
 *   anyway per docs/10 §8 — a human always reviews the receipt against
 *   the bank statement.
 * - **The "requester can never be the approver" half of the two-person
 *   rule.** `Payment` has no column recording who entered/uploaded on
 *   the customer's behalf (that only matters for phone/walk-in orders a
 *   staff member enters directly — not the customer's own storefront
 *   upload, which is this pass's only flow). What *is* enforced: the
 *   value-tiered role requirement (`OWNER` above the threshold,
 *   `MANAGER` or `OWNER` below it).
 * - **Auto-cancel after 48 hours without approval**, and the **24-hour
 *   stock hold extension**. The `StockReservation` this creates already
 *   carries the right `expiresAt`/TTL (`stock-reservation.ts`'s
 *   `reservationTtlMs("BANK_TRANSFER")`) and `releaseExpiredReservations`
 *   already knows how to release it — nothing here runs that sweep on a
 *   schedule, since no job runner exists in this codebase yet (same gap
 *   flagged in `stock-reservation.ts`'s own header comment).
 */
import "server-only";
import { db } from "@/server/db";
import {
  OrderPaymentStatus,
  OrderStatus,
  OrderActorType,
  PaymentProvider,
  PaymentStatus,
} from "@/generated/prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { rupeesToPaisa } from "@/lib/money";
import { paymentConfig } from "@/config/payment";
import {
  consumeReservation,
  releaseReservation,
} from "@/server/services/commerce/stock-reservation";
import { applyOrderTransition } from "@/server/services/commerce/order-state-machine";
import { recordAuditLog } from "@/server/services/admin/audit-log";

export async function createBankTransferPayment(orderId: string, totalPaisa: number) {
  const expiresAt = new Date(
    Date.now() + paymentConfig.bankTransferAutoCancelHours * 60 * 60 * 1000,
  );
  return db.payment.create({
    data: {
      orderId,
      provider: PaymentProvider.BANK_TRANSFER,
      amountPaisa: totalPaisa,
      status: PaymentStatus.PENDING,
      intentReference: `bank:${orderId}`,
      expiresAt,
    },
  });
}

/** docs/10 §8: "Above a configurable threshold (default NPR 100,000), approval requires an OWNER. Below it, MANAGER may approve." */
export function requiresOwnerApproval(amountPaisa: number): boolean {
  return amountPaisa >= rupeesToPaisa(paymentConfig.bankTransferApprovalThresholdRupees);
}

/**
 * The customer's (or, for a phone order, a staff member's) side of the
 * flow — attaches the uploaded receipt `Media` row to the `Payment` and
 * logs the event. Does not change `Payment.status`: attaching a receipt
 * moves the order into "awaiting review", which is already what `PENDING`
 * plus a non-null `receiptMediaId` means (see `admin/dashboard.ts`'s own
 * `countPendingBankTransferReceipts` query, which filters on exactly that
 * combination).
 */
export async function attachReceipt(paymentId: string, mediaId: string): Promise<void> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.provider !== PaymentProvider.BANK_TRANSFER) {
    throw new NotFoundError("Bank transfer payment");
  }
  await db.$transaction([
    db.payment.update({ where: { id: paymentId }, data: { receiptMediaId: mediaId } }),
    db.paymentEvent.create({
      data: { paymentId, type: "STATUS_CHANGED", payload: { event: "receipt_attached", mediaId } },
    }),
  ]);
}

export interface ApprovalActor {
  id: string;
  email: string | null;
  /** Session `roleKeys` — checked against `requiresOwnerApproval`'s threshold, not re-derived from a permission key (`payment:approve` is necessary but not sufficient above the threshold). */
  roleKeys: string[];
}

function assertCanApprove(amountPaisa: number, actor: ApprovalActor): void {
  if (requiresOwnerApproval(amountPaisa) && !actor.roleKeys.includes("OWNER")) {
    throw new AppError(
      "FORBIDDEN",
      `Payments of रु ${paymentConfig.bankTransferApprovalThresholdRupees.toLocaleString("en-IN")} or more need an Owner's approval.`,
    );
  }
}

/**
 * Approves a bank-transfer payment: marks it `PAID`, consumes the
 * order's stock reservation(s) (physical stock actually leaves now —
 * before this, it was only *held*), moves the order `PENDING_PAYMENT ->
 * CONFIRMED`, and writes both a `PaymentEvent` and an `AuditLog` entry
 * (docs/10 §8: "Every approval and rejection writes an `AuditLog` entry
 * with the actor, amount, and evidence reference").
 */
export async function approveBankTransfer(paymentId: string, actor: ApprovalActor): Promise<void> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.provider !== PaymentProvider.BANK_TRANSFER) {
    throw new NotFoundError("Bank transfer payment");
  }
  if (payment.status !== PaymentStatus.PENDING) {
    throw new AppError("PAYMENT_ALREADY_PROCESSED", "This payment has already been resolved.");
  }
  if (!payment.receiptMediaId) {
    throw new AppError("VALIDATION_FAILED", "There's no receipt attached to approve yet.");
  }
  assertCanApprove(payment.amountPaisa, actor);

  const reservations = await db.stockReservation.findMany({
    where: { orderId: payment.orderId, status: "ACTIVE" },
  });

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.PAID,
        verifiedAt: new Date(),
        verificationMethod: "MANUAL",
        approvedById: actor.id,
        approvedAt: new Date(),
      },
    });
    await tx.paymentEvent.create({
      data: { paymentId, type: "MANUAL_APPROVED", payload: { actorId: actor.id } },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: OrderPaymentStatus.PAID, paidPaisa: payment.amountPaisa },
    });
  });

  // Consuming reservations calls its own transaction per reservation
  // (`stock-reservation.ts`'s `consumeReservation`) — deliberately not
  // nested inside the transaction above, matching that function's own
  // single-responsibility transaction boundary rather than composing two
  // different files' transactions into one.
  for (const reservation of reservations) {
    await consumeReservation(reservation.id, actor.id);
  }

  await applyOrderTransition(
    payment.orderId,
    OrderStatus.CONFIRMED,
    { type: OrderActorType.ADMIN, id: actor.id, email: actor.email },
    "Bank transfer approved.",
  );

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "payment.approved",
    entityType: "Payment",
    entityId: paymentId,
    before: { status: "PENDING" },
    after: {
      status: "PAID",
      amountPaisa: payment.amountPaisa,
      receiptMediaId: payment.receiptMediaId,
    },
  });
}

export async function rejectBankTransfer(
  paymentId: string,
  actor: ApprovalActor,
  reason: string,
): Promise<void> {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.provider !== PaymentProvider.BANK_TRANSFER) {
    throw new NotFoundError("Bank transfer payment");
  }
  if (payment.status !== PaymentStatus.PENDING) {
    throw new AppError("PAYMENT_ALREADY_PROCESSED", "This payment has already been resolved.");
  }

  await db.$transaction(async (tx) => {
    await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.FAILED, rejectionReason: reason, approvedById: actor.id },
    });
    await tx.paymentEvent.create({
      data: { paymentId, type: "MANUAL_REJECTED", payload: { actorId: actor.id, reason } },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: OrderPaymentStatus.FAILED },
    });
  });

  const reservations = await db.stockReservation.findMany({
    where: { orderId: payment.orderId, status: "ACTIVE" },
  });
  for (const reservation of reservations) {
    await releaseReservation(reservation.id, "RELEASED");
  }

  await applyOrderTransition(
    payment.orderId,
    OrderStatus.PAYMENT_FAILED,
    { type: OrderActorType.ADMIN, id: actor.id, email: actor.email },
    reason,
  );

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "payment.rejected",
    entityType: "Payment",
    entityId: paymentId,
    before: { status: "PENDING" },
    after: { status: "FAILED", reason },
  });
}
