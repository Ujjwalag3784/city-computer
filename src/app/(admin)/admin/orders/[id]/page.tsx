import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/lib/errors";
import { formatNPR } from "@/lib/money";
import { OrderStatus, OrderActorType } from "@/generated/prisma/client";
import { availableTransitions } from "@/server/services/commerce/order-state-machine";
import { getOrderForAdmin } from "@/server/services/admin/orders";
import { OrderTransitionPanel } from "./_components/order-transition-panel";
import { PaymentPanel } from "./_components/payment-panel";
import { OrderTimeline } from "./_components/order-timeline";

export const metadata: Metadata = {
  title: "Order — Admin — City Computer Systems",
};

const STATUS_BADGE_VARIANT: Record<string, "primary" | "success" | "warning" | "danger" | "glass"> =
  {
    PENDING_PAYMENT: "glass",
    PAYMENT_FAILED: "danger",
    CONFIRMED: "primary",
    PREPARING: "primary",
    PACKED: "primary",
    SHIPPED: "warning",
    DELIVERED: "success",
    COMPLETED: "success",
    CANCELLED: "danger",
    RETURN_REQUESTED: "warning",
    RETURNED: "warning",
    REFUNDED: "glass",
  };

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

interface OrderDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * `/admin/orders/[id]` — docs/17-ROADMAP-PHASES.md Phase 7's admin order
 * detail: status + transition buttons, payment review panel, items,
 * addresses, and the full `OrderStatusEvent` audit trail. `id` is the
 * `Order.id` (cuid), not the customer-facing `orderNumber` — admin routes
 * throughout this codebase key off internal ids (`/admin/products/[id]`),
 * and there's no IDOR concern here the way there is for the customer
 * tracking page: access is gated purely by the `order:view` permission,
 * not by "does this session own this specific order."
 */
export default async function AdminOrderDetailPage({ params }: OrderDetailPageProps) {
  const { id } = await params;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "order:view");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect(`/auth/login?callbackUrl=/admin/orders/${id}`);
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  let detail;
  try {
    detail = await getOrderForAdmin(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const permissionKeys = session?.user.permissionKeys ?? [];
  const canUpdate = permissionKeys.includes("order:update");
  const canCancel = permissionKeys.includes("order:cancel");
  const canRefund = permissionKeys.includes("order:refund");
  const canApprovePayment = permissionKeys.includes("payment:approve");

  const nextStatuses = availableTransitions(detail.status, OrderActorType.ADMIN).filter((to) => {
    if (to === OrderStatus.CANCELLED) return canCancel;
    if (to === OrderStatus.REFUNDED) return canRefund;
    return canUpdate;
  });

  const shipping = detail.addresses.find((a) => a.type === "SHIPPING");
  const billing = detail.addresses.find((a) => a.type === "BILLING");
  const latestPayment = detail.payments[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-headline-md text-on-surface">{detail.orderNumber}</h1>
          <Badge variant={STATUS_BADGE_VARIANT[detail.status] ?? "glass"}>
            {statusLabel(detail.status)}
          </Badge>
        </div>
        <p className="text-body-sm text-on-surface-variant">
          Placed {detail.placedAt.toLocaleString()} · {detail.customer.name ?? "Guest"}
          {detail.customer.phone ? ` · ${detail.customer.phone}` : ""}
        </p>
      </div>

      <OrderTransitionPanel orderId={detail.id} nextStatuses={nextStatuses} />

      {latestPayment && (
        <Card variant="surface">
          <CardContent className="pt-[--space-card-padding]">
            <PaymentPanel
              orderId={detail.id}
              payment={latestPayment}
              canUpdate={canUpdate}
              canApprovePayment={canApprovePayment}
            />
          </CardContent>
        </Card>
      )}

      <Card variant="surface">
        <CardContent className="flex flex-col gap-3 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">Items</h2>
          <ul className="flex flex-col divide-y divide-glass-stroke">
            {detail.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="text-body-md text-on-surface">{item.productName}</p>
                  {item.variantLabel && (
                    <p className="text-body-sm text-on-surface-variant">{item.variantLabel}</p>
                  )}
                  <p className="text-body-sm text-on-surface-variant">
                    {item.skuSnapshot} · Qty {item.quantity}
                  </p>
                </div>
                <p className="text-body-md text-on-surface">{formatNPR(item.lineTotalPaisa)}</p>
              </li>
            ))}
          </ul>

          <Separator />

          <div className="flex flex-col gap-1 self-end text-right">
            <div className="flex items-baseline justify-between gap-8 text-body-sm text-on-surface-variant">
              <span>Subtotal</span>
              <span>{formatNPR(detail.totals.subtotalPaisa)}</span>
            </div>
            {detail.totals.discountPaisa > 0 && (
              <div className="flex items-baseline justify-between gap-8 text-body-sm text-success">
                <span>Discount</span>
                <span>-{formatNPR(detail.totals.discountPaisa)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-8 text-body-sm text-on-surface-variant">
              <span>Shipping</span>
              <span>{formatNPR(detail.totals.shippingPaisa)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-8 text-body-md font-medium text-on-surface">
              <span>Total</span>
              <span>{formatNPR(detail.totals.totalPaisa)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-8 text-body-sm text-on-surface-variant">
              <span>Paid</span>
              <span>{formatNPR(detail.totals.paidPaisa)}</span>
            </div>
            {detail.totals.refundedPaisa > 0 && (
              <div className="flex items-baseline justify-between gap-8 text-body-sm text-on-surface-variant">
                <span>Refunded</span>
                <span>{formatNPR(detail.totals.refundedPaisa)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card variant="surface">
        <CardContent className="flex flex-col gap-4 pt-[--space-card-padding] sm:flex-row sm:gap-8">
          {shipping && (
            <div className="flex-1">
              <h2 className="mb-2 text-body-lg font-medium text-on-surface">
                {detail.fulfilmentType === "PICKUP" ? "Pickup" : "Shipping address"}
              </h2>
              <p className="text-body-sm text-on-surface-variant">{shipping.fullName}</p>
              <p className="text-body-sm text-on-surface-variant">{shipping.phone}</p>
              {detail.fulfilmentType === "PICKUP" && detail.branch ? (
                <p className="text-body-sm text-on-surface-variant">{detail.branch.name}</p>
              ) : (
                <p className="text-body-sm text-on-surface-variant">
                  {shipping.streetAddress}, {shipping.municipality}
                  {shipping.ward ? ` (Ward ${shipping.ward})` : ""}, {shipping.district}
                </p>
              )}
            </div>
          )}
          {billing && (
            <div className="flex-1">
              <h2 className="mb-2 text-body-lg font-medium text-on-surface">Billing address</h2>
              <p className="text-body-sm text-on-surface-variant">{billing.fullName}</p>
              <p className="text-body-sm text-on-surface-variant">{billing.phone}</p>
              <p className="text-body-sm text-on-surface-variant">
                {billing.streetAddress}, {billing.municipality}
                {billing.ward ? ` (Ward ${billing.ward})` : ""}, {billing.district}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {(detail.customerNote || detail.internalNote || detail.cancellationReason) && (
        <Card variant="surface">
          <CardContent className="flex flex-col gap-2 pt-[--space-card-padding]">
            {detail.customerNote && (
              <p className="text-body-sm text-on-surface-variant">
                Customer note: {detail.customerNote}
              </p>
            )}
            {detail.internalNote && (
              <p className="text-body-sm text-on-surface-variant">
                Internal note: {detail.internalNote}
              </p>
            )}
            {detail.cancellationReason && (
              <p className="text-body-sm text-on-surface-variant">
                Cancellation reason: {detail.cancellationReason}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card variant="surface">
        <CardContent className="flex flex-col gap-2 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">History</h2>
          <OrderTimeline events={detail.statusEvents} />
        </CardContent>
      </Card>
    </div>
  );
}
