/**
 * `/admin/orders` — docs/17-ROADMAP-PHASES.md Phase 7's admin order
 * management dashboard. List + detail reads only; every mutation
 * (`transitionOrderAction`, `approveBankTransferAction`, ...) lives in the
 * route's own `_actions.ts` and calls straight into `order-state-machine.ts`
 * / `payments/cod.ts` / `payments/bank-transfer.ts` — this file has no
 * write functions of its own, matching `admin/dashboard.ts`'s own
 * read-only scope.
 *
 * Deliberately its own types rather than reusing `commerce/order-lookup.ts`'s
 * customer-facing `OrderDetail` — the admin view needs the raw
 * `OrderStatus` (not the 5-milestone customer collapse), the full
 * `OrderStatusEvent` audit trail, and customer contact fields a shopper's
 * own view has no reason to carry. Some item/address mapping is genuinely
 * duplicated between the two files; see `receipt-upload.ts`'s own doc
 * comment for why a small duplication beats a forced shared abstraction
 * across a customer-facing and an admin-facing concern mid-Phase-7.
 */
import "server-only";
import { db } from "@/server/db";
import {
  OrderStatus,
  OrderPaymentStatus,
  PaymentProvider,
  PaymentStatus,
} from "@/generated/prisma/client";
import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";

/** Mirrors `admin/dashboard.ts`'s own `AWAITING_SHIPMENT_STATUSES` — kept as a separate literal here rather than importing it, since that file's constant isn't exported (dashboard-module-private) and re-exporting it solely for this file isn't worth the churn. */
const AWAITING_SHIPMENT_STATUSES: OrderStatus[] = [
  OrderStatus.CONFIRMED,
  OrderStatus.PREPARING,
  OrderStatus.PACKED,
];

export type AdminOrderFilter = "all" | "needs-review" | "paid-not-sent" | "cancelled";
export type AdminOrderPaymentMethodFilter = "cod" | "bank_transfer";

export interface AdminOrderListQuery {
  q?: string;
  filter: AdminOrderFilter;
  paymentMethod?: AdminOrderPaymentMethodFilter;
  page: number;
}

export interface AdminOrderListItem {
  id: string;
  orderNumber: string;
  customerName: string | null;
  phone: string | null;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  paymentProvider: PaymentProvider | null;
  totalPaisa: number;
  placedAt: Date;
  /** A bank-transfer receipt is uploaded and nobody has approved or rejected it yet — same condition `dashboard.ts`'s `countPendingBankTransferReceipts` counts. */
  needsReview: boolean;
}

const ORDER_LIST_PAGE_SIZE = 20;

function providerFilter(method: AdminOrderPaymentMethodFilter): PaymentProvider {
  return method === "cod" ? PaymentProvider.COD : PaymentProvider.BANK_TRANSFER;
}

function buildListWhere(query: AdminOrderListQuery): Prisma.OrderWhereInput {
  const clauses: Prisma.OrderWhereInput[] = [];

  if (query.q) {
    clauses.push({
      OR: [
        { orderNumber: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q } },
        { email: { contains: query.q, mode: "insensitive" } },
        { customer: { is: { name: { contains: query.q, mode: "insensitive" } } } },
      ],
    });
  }

  if (query.filter === "needs-review") {
    clauses.push({
      payments: {
        some: {
          provider: PaymentProvider.BANK_TRANSFER,
          status: PaymentStatus.PENDING,
          receiptMediaId: { not: null },
          approvedAt: null,
        },
      },
    });
  } else if (query.filter === "paid-not-sent") {
    clauses.push({
      paymentStatus: OrderPaymentStatus.PAID,
      status: { in: AWAITING_SHIPMENT_STATUSES },
    });
  } else if (query.filter === "cancelled") {
    clauses.push({ status: OrderStatus.CANCELLED });
  }

  if (query.paymentMethod) {
    clauses.push({ payments: { some: { provider: providerFilter(query.paymentMethod) } } });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

export interface AdminOrderListResult {
  items: AdminOrderListItem[];
  total: number;
  hasNext: boolean;
}

export async function listOrdersForAdmin(
  query: AdminOrderListQuery,
): Promise<AdminOrderListResult> {
  const where = buildListWhere(query);

  const [rows, total] = await Promise.all([
    db.order.findMany({
      where,
      orderBy: { placedAt: "desc" },
      skip: (query.page - 1) * ORDER_LIST_PAGE_SIZE,
      take: ORDER_LIST_PAGE_SIZE + 1,
      include: {
        customer: { select: { name: true } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
    }),
    db.order.count({ where }),
  ]);

  const hasNext = rows.length > ORDER_LIST_PAGE_SIZE;
  const items = rows.slice(0, ORDER_LIST_PAGE_SIZE).map((order) => {
    const payment = order.payments[0] ?? null;
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      customerName: order.customer.name,
      phone: order.phone,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentProvider: payment?.provider ?? null,
      totalPaisa: order.totalPaisa,
      placedAt: order.placedAt,
      needsReview: Boolean(
        payment &&
          payment.provider === PaymentProvider.BANK_TRANSFER &&
          payment.status === PaymentStatus.PENDING &&
          payment.receiptMediaId &&
          !payment.approvedAt,
      ),
    };
  });

  return { items, total, hasNext };
}

export interface AdminOrderDetailItem {
  id: string;
  productName: string;
  variantLabel: string | null;
  skuSnapshot: string;
  imageUrl: string | null;
  quantity: number;
  unitPricePaisa: number;
  lineTotalPaisa: number;
}

export interface AdminOrderDetailAddress {
  type: "SHIPPING" | "BILLING";
  fullName: string;
  phone: string;
  province: string;
  district: string;
  municipality: string;
  ward: number | null;
  streetAddress: string;
  landmark: string | null;
}

export interface AdminOrderDetailPayment {
  id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  amountPaisa: number;
  receiptMediaId: string | null;
  rejectionReason: string | null;
  approvedAt: Date | null;
  createdAt: Date;
}

export interface AdminOrderStatusEvent {
  id: string;
  fromStatus: OrderStatus | null;
  toStatus: OrderStatus;
  actorType: string;
  actorName: string | null;
  note: string | null;
  createdAt: Date;
}

export interface AdminOrderDetail {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: OrderPaymentStatus;
  fulfilmentType: "DELIVERY" | "PICKUP";
  branch: { id: string; name: string } | null;
  customer: { id: string; name: string | null; email: string | null; phone: string | null };
  items: AdminOrderDetailItem[];
  addresses: AdminOrderDetailAddress[];
  payments: AdminOrderDetailPayment[];
  statusEvents: AdminOrderStatusEvent[];
  totals: {
    subtotalPaisa: number;
    discountPaisa: number;
    shippingPaisa: number;
    taxPaisa: number;
    totalPaisa: number;
    paidPaisa: number;
    refundedPaisa: number;
  };
  customerNote: string | null;
  internalNote: string | null;
  cancellationReason: string | null;
  placedAt: Date;
}

const ORDER_DETAIL_INCLUDE = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  branch: { select: { id: true, name: true } },
  items: true,
  addresses: true,
  payments: { orderBy: { createdAt: "desc" } },
  statusEvents: {
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true, email: true } } },
  },
} satisfies Prisma.OrderInclude;

export async function getOrderForAdmin(orderId: string): Promise<AdminOrderDetail> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    include: ORDER_DETAIL_INCLUDE,
  });
  if (!order) throw new NotFoundError("Order");

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    fulfilmentType: order.fulfilmentType,
    branch: order.branch,
    customer: order.customer,
    items: order.items.map((item) => ({
      id: item.id,
      productName: item.productNameSnapshot,
      variantLabel: item.variantTitleSnapshot,
      skuSnapshot: item.skuSnapshot,
      imageUrl: item.imageUrlSnapshot,
      quantity: item.quantity,
      unitPricePaisa: item.unitPricePaisa,
      lineTotalPaisa: item.lineTotalPaisa,
    })),
    addresses: order.addresses.map((address) => ({
      type: address.type,
      fullName: address.fullName,
      phone: address.phone,
      province: address.province,
      district: address.district,
      municipality: address.municipality,
      ward: address.ward,
      streetAddress: address.streetAddress,
      landmark: address.landmark,
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      provider: payment.provider,
      status: payment.status,
      amountPaisa: payment.amountPaisa,
      receiptMediaId: payment.receiptMediaId,
      rejectionReason: payment.rejectionReason,
      approvedAt: payment.approvedAt,
      createdAt: payment.createdAt,
    })),
    statusEvents: order.statusEvents.map((event) => ({
      id: event.id,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      actorType: event.actorType,
      actorName: event.actor?.name ?? event.actor?.email ?? null,
      note: event.note,
      createdAt: event.createdAt,
    })),
    totals: {
      subtotalPaisa: order.subtotalPaisa,
      discountPaisa: order.discountPaisa,
      shippingPaisa: order.shippingPaisa,
      taxPaisa: order.taxPaisa,
      totalPaisa: order.totalPaisa,
      paidPaisa: order.paidPaisa,
      refundedPaisa: order.refundedPaisa,
    },
    customerNote: order.customerNote,
    internalNote: order.internalNote,
    cancellationReason: order.cancellationReason,
    placedAt: order.placedAt,
  };
}
