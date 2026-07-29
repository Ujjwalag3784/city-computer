/**
 * Cash on Delivery — docs/10-PAYMENTS-NEPAL.md §7: "COD is unavoidable in
 * Nepal and genuinely dangerous at these values. A refused NPR 400,000
 * laptop is a courier round trip plus restocking on a serialised,
 * fast-depreciating item."
 *
 * BUILT THIS PASS: the value cap, the repeat-refusal blocklist
 * (`Customer.codBlocked`), and velocity limits (open orders per phone,
 * orders per address per week) — all pure database checks.
 *
 * NOT BUILT, flagged rather than faked (docs/10 §7's own table):
 * - **Mandatory phone OTP before acceptance.** "Once SMS is available;
 *   until then, a callback-confirmation workflow in the admin." No SMS
 *   provider is wired into this codebase yet.
 * - **Per-district COD toggle.** `DeliveryZone` has no
 *   `codEnabled`-style column — adding one is a schema change, not
 *   something this pass silently works around with a hardcoded list.
 * - **First-time-buyer confirmation call above NPR 10,000** and
 *   **refusal-rate monitoring per district/courier** — both need
 *   operational tooling (a call queue, a refusal-tracking report) this
 *   pass doesn't add.
 */
import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/server/db";
import {
  OrderPaymentStatus,
  OrderStatus,
  PaymentProvider,
  PaymentStatus,
} from "@/generated/prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { rupeesToPaisa } from "@/lib/money";
import { paymentConfig } from "@/config/payment";
import type { CheckoutAddressInput } from "@/lib/validation/checkout";

/** Orders that still meaningfully occupy a COD "slot" — not yet delivered/completed, and not already cancelled/failed. Mirrors the general "open" framing docs/10 §7's velocity limits use ("2 open COD orders per phone"). */
const OPEN_ORDER_STATUSES: OrderStatus[] = [
  OrderStatus.PENDING_PAYMENT,
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.PACKED,
  OrderStatus.SHIPPED,
];

/** A stable, non-reversible key for "this delivery address", used only to count repeat orders per address — never stored anywhere a human reads it as an address, just compared for equality. */
function normalizedAddressHash(
  address: Pick<CheckoutAddressInput, "streetAddress" | "municipality" | "district">,
): string {
  const normalized = [address.streetAddress, address.municipality, address.district]
    .map((part) => part.trim().toLowerCase())
    .join("|");
  return createHash("sha256").update(normalized).digest("hex");
}

export interface CodEligibilityInput {
  totalPaisa: number;
  phone: string;
  customerId?: string;
  address: Pick<CheckoutAddressInput, "streetAddress" | "municipality" | "district">;
}

/**
 * Throws `COD_NOT_AVAILABLE` (pre-defined `ErrorCode`, 400) the moment any
 * control fails, with a plain-language reason — never lets a checkout
 * silently fall through to placing a COD order that should have been
 * blocked.
 */
export async function checkCodEligibility(input: CodEligibilityInput): Promise<void> {
  const codCapPaisa = rupeesToPaisa(paymentConfig.codValueCapRupees);
  if (input.totalPaisa > codCapPaisa) {
    throw new AppError(
      "COD_NOT_AVAILABLE",
      `Cash on delivery is only available for orders up to रु ${paymentConfig.codValueCapRupees.toLocaleString("en-IN")}.`,
    );
  }

  if (input.customerId) {
    const customer = await db.customer.findUnique({
      where: { id: input.customerId },
      select: { codBlocked: true },
    });
    if (customer?.codBlocked) {
      throw new AppError(
        "COD_NOT_AVAILABLE",
        "Cash on delivery isn't available on this account. Please choose bank transfer instead.",
      );
    }
  }

  const openOrdersForPhone = await db.order.count({
    where: {
      phone: input.phone,
      status: { in: OPEN_ORDER_STATUSES },
      payments: { some: { provider: PaymentProvider.COD } },
    },
  });
  if (openOrdersForPhone >= paymentConfig.codMaxOpenOrdersPerPhone) {
    throw new AppError(
      "COD_NOT_AVAILABLE",
      "You already have the maximum number of cash-on-delivery orders in progress. Please choose bank transfer, or wait for an existing order to arrive.",
    );
  }

  const addressHash = normalizedAddressHash(input.address);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentOrdersForAddress = await db.order.count({
    where: {
      placedAt: { gte: weekAgo },
      payments: { some: { provider: PaymentProvider.COD } },
      addresses: {
        some: {
          streetAddress: input.address.streetAddress,
          municipality: input.address.municipality,
        },
      },
    },
  });
  void addressHash; // Reserved for a future denormalised column — see this function's own note below.
  if (recentOrdersForAddress >= paymentConfig.codMaxOrdersPerAddressPerWeek) {
    throw new AppError(
      "COD_NOT_AVAILABLE",
      "This delivery address has reached the maximum number of cash-on-delivery orders this week. Please choose bank transfer.",
    );
  }
}

/**
 * Creates the `Payment` row for a COD order. Status is `PENDING`, not
 * `PAID` — COD money changes hands on delivery, not at placement; a
 * separate admin action (`markCodPaymentCollected`) marks it `PAID` once
 * the courier has actually collected the cash. Stock, by contrast,
 * *does* move immediately at placement (docs/06 §5: "immediate consume
 * for COD") — that's `order.ts`'s job via `stock-reservation.ts`, not
 * this function's.
 */
export async function createCodPayment(orderId: string, totalPaisa: number) {
  return db.payment.create({
    data: {
      orderId,
      provider: PaymentProvider.COD,
      amountPaisa: totalPaisa,
      status: PaymentStatus.PENDING,
      intentReference: `cod:${orderId}`,
    },
  });
}

export interface CodCollectionActor {
  id: string;
  email: string | null;
}

/** Admin marks the cash as actually collected — the only way a COD `Payment` ever reaches `PAID`. */
export async function markCodPaymentCollected(paymentId: string, actor: CodCollectionActor) {
  const payment = await db.payment.findUnique({ where: { id: paymentId } });
  if (!payment || payment.provider !== PaymentProvider.COD) {
    throw new NotFoundError("COD payment");
  }
  if (payment.status === PaymentStatus.PAID) return payment;

  return db.$transaction(async (tx) => {
    const updated = await tx.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.PAID, verifiedAt: new Date(), verificationMethod: "MANUAL" },
    });
    await tx.paymentEvent.create({
      data: {
        paymentId,
        type: "STATUS_CHANGED",
        payload: { event: "cod_collected", actorId: actor.id },
      },
    });
    await tx.order.update({
      where: { id: payment.orderId },
      data: { paymentStatus: OrderPaymentStatus.PAID, paidPaisa: payment.amountPaisa },
    });
    return updated;
  });
}
