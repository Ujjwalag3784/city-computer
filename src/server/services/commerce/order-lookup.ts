/**
 * Order lookup for the customer-facing `/order/[orderNumber]` tracking
 * page — docs/17-ROADMAP-PHASES.md Phase 7. Two access paths, matching
 * docs/13-SECURITY.md's "capability and ownership are checked
 * separately" rule:
 *
 * 1. `getOrderDetailIfOwner` — the signed-in shopper whose `Customer`
 *    row this order belongs to.
 * 2. `verifyOrderAccessByPhone` — anyone (signed in or guest) who can
 *    prove they know the phone number the order was placed under, per
 *    docs/02's own "Public order tracking by order number + phone"
 *    feature line. Neither path ever reveals *which* part of an
 *    order-number+phone pair was wrong — both return `null` on any
 *    mismatch, the same generic "not found" a stranger guessing an order
 *    number gets, so this can't be used to enumerate valid phone numbers
 *    or valid order numbers independently.
 *
 * NOTE ON SCOPE (flagged deviation from docs/02's fuller route table):
 * docs/02 §4 specifies three separate routes —
 * `/order/confirmation/[orderNumber]` (post-checkout), `/track` +
 * `/track/[orderNumber]` (public, phone-gated, deliberately limited
 * payload), and `/account/orders/[orderNumber]` (full detail, auth-gated).
 * This pass builds one unified `/order/[orderNumber]` page instead,
 * per this session's own instruction ("Customer order tracking page
 * (`/order/[id]`)") — it shows the *full* detail (not `/track`'s
 * deliberately-reduced payload) to whichever of the two access paths
 * above succeeds. A future pass can split this back into the three
 * routes if the reduced-payload public view turns out to matter.
 */
import "server-only";
import { db } from "@/server/db";
import { normalizeNepalPhone } from "@/lib/nepal";
import { isValidOrderNumber } from "@/lib/ids";
import { OrderStatus } from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import type { OrderVisibleStatus } from "@/components/commerce/order-status-tracker";

export interface OrderDetailItem {
  id: string;
  productName: string;
  variantLabel: string | null;
  imageUrl: string | null;
  quantity: number;
  unitPricePaisa: number;
  lineTotalPaisa: number;
}

export interface OrderDetailAddress {
  type: "SHIPPING" | "BILLING";
  fullName: string;
  phone: string;
  alternatePhone: string | null;
  province: string;
  district: string;
  municipality: string;
  ward: number | null;
  streetAddress: string;
  landmark: string | null;
}

export interface OrderDetailPayment {
  id: string;
  provider: "COD" | "BANK_TRANSFER" | string;
  status: string;
  amountPaisa: number;
  receiptMediaId: string | null;
  rejectionReason: string | null;
}

export interface OrderDetailBranch {
  name: string;
  addressLine: string;
  district: string;
}

export interface OrderDetail {
  id: string;
  orderNumber: string;
  rawStatus: OrderStatus;
  visibleStatus: OrderVisibleStatus;
  /** Set only for the three post-tracker states `OrderStatusTracker` has no milestone for — rendered as a plain note alongside a tracker frozen at "delivered". */
  extraStatusNote: string | null;
  placedAt: Date;
  fulfilmentType: "DELIVERY" | "PICKUP";
  branch: OrderDetailBranch | null;
  items: OrderDetailItem[];
  addresses: OrderDetailAddress[];
  totals: {
    subtotalPaisa: number;
    discountPaisa: number;
    shippingPaisa: number;
    taxPaisa: number;
    totalPaisa: number;
    paidPaisa: number;
  };
  payment: OrderDetailPayment | null;
  customerNote: string | null;
  cancellationReason: string | null;
}

/**
 * docs/06 §6's status table folded onto `OrderStatusTracker`'s five
 * customer-facing milestones (see that component's own doc comment for
 * the full mapping table this mirrors).
 */
function mapVisibleStatus(status: OrderStatus): {
  visible: OrderVisibleStatus;
  note: string | null;
} {
  switch (status) {
    case OrderStatus.PENDING_PAYMENT:
    case OrderStatus.PAYMENT_FAILED:
      return { visible: "placed", note: null };
    case OrderStatus.CONFIRMED:
    case OrderStatus.PREPARING:
      return { visible: "confirmed", note: null };
    case OrderStatus.PACKED:
      return { visible: "packed", note: null };
    case OrderStatus.SHIPPED:
      return { visible: "shipped", note: null };
    case OrderStatus.DELIVERED:
    case OrderStatus.COMPLETED:
      return { visible: "delivered", note: null };
    case OrderStatus.CANCELLED:
      return { visible: "cancelled", note: null };
    // `OrderStatusTracker` has no return/refund milestones yet (flagged in
    // its own doc comment) — freeze the tracker at "delivered" (the order
    // did complete its forward journey) and surface the real state as a
    // plain-text note instead of silently mislabelling it "Delivered".
    case OrderStatus.RETURN_REQUESTED:
      return { visible: "delivered", note: "A return has been requested for this order." };
    case OrderStatus.RETURNED:
      return { visible: "delivered", note: "This order was returned." };
    case OrderStatus.REFUNDED:
      return { visible: "delivered", note: "This order was refunded." };
    default:
      return { visible: "placed", note: null };
  }
}

const ORDER_INCLUDE = {
  items: true,
  addresses: true,
  payments: { orderBy: { createdAt: "desc" } },
  branch: { select: { name: true, addressLine: true, district: true } },
} satisfies Prisma.OrderInclude;

type OrderWithRelations = Prisma.OrderGetPayload<{ include: typeof ORDER_INCLUDE }>;

function toDetail(order: OrderWithRelations): OrderDetail {
  const { visible, note } = mapVisibleStatus(order.status);
  // Most recent payment attempt only — a retried/re-created payment (not
  // built this pass, see `payments/*.ts` headers) would need this to pick
  // the active one specifically; for now there's at most one payment per
  // order so "most recent" and "the" payment are the same thing.
  const payment = order.payments[0] ?? null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    rawStatus: order.status,
    visibleStatus: visible,
    extraStatusNote: note,
    placedAt: order.placedAt,
    fulfilmentType: order.fulfilmentType,
    branch: order.branch,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productNameSnapshot,
      variantLabel: item.variantTitleSnapshot,
      imageUrl: item.imageUrlSnapshot,
      quantity: item.quantity,
      unitPricePaisa: item.unitPricePaisa,
      lineTotalPaisa: item.lineTotalPaisa,
    })),
    addresses: order.addresses.map((address) => ({
      type: address.type,
      fullName: address.fullName,
      phone: address.phone,
      alternatePhone: address.alternatePhone,
      province: address.province,
      district: address.district,
      municipality: address.municipality,
      ward: address.ward,
      streetAddress: address.streetAddress,
      landmark: address.landmark,
    })),
    totals: {
      subtotalPaisa: order.subtotalPaisa,
      discountPaisa: order.discountPaisa,
      shippingPaisa: order.shippingPaisa,
      taxPaisa: order.taxPaisa,
      totalPaisa: order.totalPaisa,
      paidPaisa: order.paidPaisa,
    },
    payment: payment
      ? {
          id: payment.id,
          provider: payment.provider,
          status: payment.status,
          amountPaisa: payment.amountPaisa,
          receiptMediaId: payment.receiptMediaId,
          rejectionReason: payment.rejectionReason,
        }
      : null,
    customerNote: order.customerNote,
    cancellationReason: order.cancellationReason,
  };
}

/** Signed-in shopper viewing their own order — `null` for "doesn't exist" and "exists but isn't yours" alike, on purpose (see file doc comment). */
export async function getOrderDetailIfOwner(
  orderNumber: string,
  userId: string | undefined,
): Promise<OrderDetail | null> {
  if (!userId || !isValidOrderNumber(orderNumber)) return null;

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: ORDER_INCLUDE,
  });
  if (!order) return null;

  const customer = await db.customer.findUnique({
    where: { id: order.customerId },
    select: { userId: true },
  });
  if (!customer || customer.userId !== userId) return null;

  return toDetail(order);
}

/** Guest (or signed-in-but-not-the-owner) access via order number + the phone the order was placed under. */
export async function verifyOrderAccessByPhone(
  orderNumber: string,
  phone: string,
): Promise<OrderDetail | null> {
  if (!isValidOrderNumber(orderNumber)) return null;
  const normalizedPhone = normalizeNepalPhone(phone);
  if (!normalizedPhone) return null;

  const order = await db.order.findUnique({
    where: { orderNumber },
    include: ORDER_INCLUDE,
  });
  if (!order || !order.phone) return null;
  if (order.phone !== normalizedPhone) return null;

  return toDetail(order);
}
