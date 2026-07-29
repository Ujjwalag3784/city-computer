/**
 * Order placement — docs/17-ROADMAP-PHASES.md Phase 7's "order placement
 * transaction". This is the one function that turns a `Cart` into an
 * `Order`: it re-validates and re-prices everything server-side (this
 * session's standing constraint — never trust a client-sent amount),
 * reserves stock, creates the payment record for whichever of the two
 * rails this pass supports (COD, bank transfer), and clears the cart.
 *
 * COMPOSED, NOT ONE MEGA-TRANSACTION: order/item/address/status-event
 * creation is one transaction; stock reservation
 * (`stock-reservation.ts`'s `reserveStock`) is its own; the payment
 * record (`payments/cod.ts` / `payments/bank-transfer.ts`) is its own.
 * Each piece is already internally consistent on its own terms (an order
 * without a reservation is recoverable — admin can retry; a reservation
 * without a payment row is not a real-world state this function's own
 * control flow can produce, since the payment write is the very next
 * unconditional step after a successful reservation). A single
 * cross-service transaction spanning four different files' own
 * transaction boundaries would be more fragile than useful here.
 */
import "server-only";
import { db } from "@/server/db";
import {
  FulfilmentType,
  OrderActorType,
  OrderPaymentStatus,
  OrderSourceChannel,
  OrderStatus,
} from "@/generated/prisma/client";
import { AppError } from "@/lib/errors";
import { normalizeNepalPhone } from "@/lib/nepal";
import { findOrCreateCustomerId, getCartView } from "@/server/services/commerce/cart";
import { previewCoupon } from "@/server/services/commerce/coupon";
import {
  buildOrderTotals,
  computeShippingPaisa,
  resolveDeliveryZoneForDistrict,
} from "@/server/services/commerce/checkout";
import { generateOrderNumber } from "@/server/services/commerce/order-number";
import { getDefaultBranchId } from "@/server/services/admin/stock";
import {
  reserveStock,
  consumeReservation,
  reservationTtlMs,
} from "@/server/services/commerce/stock-reservation";
import { checkCodEligibility, createCodPayment } from "@/server/services/commerce/payments/cod";
import { createBankTransferPayment } from "@/server/services/commerce/payments/bank-transfer";
import type { CheckoutAddressInput, PlaceOrderInput } from "@/lib/validation/checkout";
import type { Order } from "@/generated/prisma/client";

export interface PlaceOrderIdentity {
  userId?: string;
  userEmail?: string | null;
}

/**
 * `User.id` -> `Customer.id`, extended for the guest-checkout case
 * `cart.ts`'s `findOrCreateCustomerId` doesn't need to handle (that one
 * requires a signed-in user). A guest placing an order with a phone
 * number already on file gets that same `Customer` row rather than a
 * fresh duplicate every time — matched by normalised phone, `userId:
 * null` only (a guest checkout must never silently attach itself to a
 * registered account's `Customer` row just because the phone matches).
 */
async function resolveCustomerId(
  identity: PlaceOrderIdentity,
  address: CheckoutAddressInput,
): Promise<string> {
  if (identity.userId) {
    return findOrCreateCustomerId(identity);
  }

  const normalizedPhone = normalizeNepalPhone(address.phone);
  const existingGuest = normalizedPhone
    ? await db.customer.findFirst({
        where: { phone: normalizedPhone, userId: null },
        select: { id: true },
      })
    : null;
  if (existingGuest) return existingGuest.id;

  const created = await db.customer.create({
    data: { phone: normalizedPhone, name: address.fullName },
    select: { id: true },
  });
  return created.id;
}

interface VariantSnapshot {
  sku: string;
  title: string | null;
  costPaisa: number | null;
  allowBackorder: boolean;
}

async function getVariantSnapshots(variantIds: string[]): Promise<Map<string, VariantSnapshot>> {
  const variants = await db.variant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, sku: true, title: true, costPaisa: true, allowBackorder: true },
  });
  return new Map(variants.map((v) => [v.id, v]));
}

export async function placeOrder(
  cartId: string,
  input: PlaceOrderInput,
  identity: PlaceOrderIdentity,
): Promise<Order> {
  const cartView = await getCartView(cartId);
  if (cartView.items.length === 0) {
    throw new AppError("CART_EMPTY", "Your cart is empty.");
  }
  if (cartView.items.some((item) => item.isOutOfStock)) {
    throw new AppError(
      "INSUFFICIENT_STOCK",
      "Something in your cart just went out of stock. Please review your cart before placing your order.",
    );
  }

  const cart = await db.cart.findUnique({ where: { id: cartId } });
  if (!cart) throw new AppError("CART_EMPTY", "Your cart is empty.");

  const shippingAddress = input.shippingAddress;
  const billingAddress = input.billingSameAsShipping
    ? shippingAddress
    : (input.billingAddress ?? shippingAddress);

  const zone =
    input.fulfilmentType === "DELIVERY"
      ? await resolveDeliveryZoneForDistrict(shippingAddress.district)
      : null;
  if (input.fulfilmentType === "DELIVERY" && !zone) {
    throw new AppError(
      "ADDRESS_OUTSIDE_DELIVERY_ZONE",
      "We don't have a delivery rate set up for this district yet — please contact us to arrange delivery, or choose branch pickup.",
    );
  }
  const shippingPaisa = await computeShippingPaisa(zone, cartView, input.fulfilmentType);

  let discountPaisa = 0;
  let appliedCoupon: { id: string; code: string } | null = null;
  const requestedCouponCode = input.couponCode ?? cart.couponCode ?? undefined;
  if (requestedCouponCode) {
    const customerIdForCoupon = identity.userId
      ? (await db.customer.findUnique({ where: { userId: identity.userId }, select: { id: true } }))
          ?.id
      : undefined;
    const coupon = await previewCoupon(requestedCouponCode, cartView, customerIdForCoupon);
    discountPaisa = coupon.discountPaisa;
    const couponRow = await db.coupon.findUnique({
      where: { code: coupon.code },
      select: { id: true },
    });
    if (couponRow) appliedCoupon = { id: couponRow.id, code: coupon.code };
  }

  const totals = buildOrderTotals(cartView, discountPaisa, shippingPaisa);

  if (input.fulfilmentType === "PICKUP" && !input.branchId) {
    throw new AppError("VALIDATION_FAILED", "Pick which branch you'll collect this from.");
  }
  const branchId =
    input.fulfilmentType === "PICKUP" ? (input.branchId as string) : await getDefaultBranchId();
  if (!branchId) {
    throw new AppError("DEPENDENCY_UNAVAILABLE", "No fulfilment branch is configured yet.");
  }

  const normalizedPhone = normalizeNepalPhone(shippingAddress.phone) ?? shippingAddress.phone;

  if (input.paymentMethod === "COD") {
    await checkCodEligibility({
      totalPaisa: totals.totalPaisa,
      phone: normalizedPhone,
      customerId: identity.userId
        ? (
            await db.customer.findUnique({
              where: { userId: identity.userId },
              select: { id: true },
            })
          )?.id
        : undefined,
      address: shippingAddress,
    });
  }

  const customerId = await resolveCustomerId(identity, shippingAddress);
  const placedAt = new Date();
  const orderNumber = await generateOrderNumber(placedAt);

  // Fetched once up front and reused for both the order-item snapshots
  // (inside the transaction below) and the backorder check after it —
  // the variant rows don't change within this function's own lifetime,
  // so there's no correctness reason to re-query them twice.
  const variantSnapshots = await getVariantSnapshots(cartView.items.map((item) => item.variantId));

  const order = await db.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        email: identity.userEmail ?? null,
        phone: normalizedPhone,
        status: OrderStatus.PENDING_PAYMENT,
        paymentStatus: OrderPaymentStatus.UNPAID,
        fulfilmentType: input.fulfilmentType as FulfilmentType,
        branchId,
        subtotalPaisa: totals.subtotalPaisa,
        discountPaisa: totals.discountPaisa,
        shippingPaisa: totals.shippingPaisa,
        taxPaisa: totals.taxPaisa,
        totalPaisa: totals.totalPaisa,
        taxInclusive: true,
        couponCode: appliedCoupon?.code ?? null,
        couponDiscountPaisa: appliedCoupon ? totals.discountPaisa : null,
        deliveryZoneId: zone?.id,
        customerNote: input.customerNote,
        sourceChannel: OrderSourceChannel.WEB,
        placedAt,
      },
    });

    for (const item of cartView.items) {
      const snapshot = variantSnapshots.get(item.variantId);
      await tx.orderItem.create({
        data: {
          orderId: created.id,
          variantId: item.variantId,
          productNameSnapshot: item.productName,
          variantTitleSnapshot: snapshot?.title ?? item.variantLabel,
          skuSnapshot: snapshot?.sku ?? item.variantId,
          imageUrlSnapshot: item.imageUrl,
          unitPricePaisa: item.unitPricePaisa,
          quantity: item.quantity,
          lineTotalPaisa: item.lineTotalPaisa,
          costPaisaSnapshot: snapshot?.costPaisa ?? null,
        },
      });
    }

    await tx.orderAddress.create({
      data: {
        orderId: created.id,
        type: "SHIPPING",
        fullName: shippingAddress.fullName,
        phone: normalizedPhone,
        alternatePhone: shippingAddress.alternatePhone,
        province: shippingAddress.province,
        district: shippingAddress.district,
        municipality: shippingAddress.municipality,
        ward: shippingAddress.ward,
        streetAddress: shippingAddress.streetAddress,
        landmark: shippingAddress.landmark,
      },
    });
    if (!input.billingSameAsShipping) {
      await tx.orderAddress.create({
        data: {
          orderId: created.id,
          type: "BILLING",
          fullName: billingAddress.fullName,
          phone: normalizeNepalPhone(billingAddress.phone) ?? billingAddress.phone,
          alternatePhone: billingAddress.alternatePhone,
          province: billingAddress.province,
          district: billingAddress.district,
          municipality: billingAddress.municipality,
          ward: billingAddress.ward,
          streetAddress: billingAddress.streetAddress,
          landmark: billingAddress.landmark,
        },
      });
    }

    await tx.orderStatusEvent.create({
      data: {
        orderId: created.id,
        fromStatus: null,
        toStatus: OrderStatus.PENDING_PAYMENT,
        actorId: identity.userId ?? null,
        actorType: OrderActorType.CUSTOMER,
        note: "Order placed.",
      },
    });

    if (appliedCoupon) {
      await tx.couponRedemption.create({
        data: {
          couponId: appliedCoupon.id,
          orderId: created.id,
          customerId,
          discountPaisa: totals.discountPaisa,
        },
      });
      await tx.coupon.update({
        where: { id: appliedCoupon.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    return created;
  });

  const allowBackorderVariantIds = new Set(
    [...variantSnapshots.entries()].filter(([, v]) => v.allowBackorder).map(([id]) => id),
  );
  const ttlMs =
    input.paymentMethod === "COD" ? reservationTtlMs("COD") : reservationTtlMs("BANK_TRANSFER");
  const reservations = await reserveStock(
    cartView.items.map((item) => ({
      variantId: item.variantId,
      branchId,
      quantity: item.quantity,
    })),
    { orderId: order.id, expiresAt: new Date(Date.now() + ttlMs), allowBackorderVariantIds },
  );

  if (input.paymentMethod === "COD") {
    await createCodPayment(order.id, totals.totalPaisa);
    // docs/06 §5: "immediate consume for COD" — physical stock leaves now,
    // not held pending a review step that (for COD) doesn't exist.
    for (const reservation of reservations) {
      await consumeReservation(reservation.id);
    }
  } else {
    await createBankTransferPayment(order.id, totals.totalPaisa);
  }

  await db.cartItem.deleteMany({ where: { cartId } });
  await db.cart.update({ where: { id: cartId }, data: { couponCode: null } });

  return order;
}
