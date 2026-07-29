import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/lib/errors";
import { formatNPR } from "@/lib/money";
import { formatRelativeTime } from "@/lib/date";
import { getCustomerForAdmin } from "@/server/services/admin/customers";
import { CodBlockToggle } from "./_components/cod-block-toggle";
import { CustomerNotes } from "./_components/customer-notes";

export const metadata: Metadata = {
  title: "Customer — Admin — City Computer Systems",
};

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function mapLink(address: {
  latitude: number | null;
  longitude: number | null;
  streetAddress: string;
  municipality: string;
  district: string;
}): string {
  if (address.latitude !== null && address.longitude !== null) {
    return `https://www.google.com/maps?q=${address.latitude},${address.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${address.streetAddress}, ${address.municipality}, ${address.district}, Nepal`,
  )}`;
}

interface CustomerDetailPageProps {
  params: Promise<{ id: string }>;
}

/**
 * `/admin/customers/[id]` — docs/09-ADMIN-DAD-MODE.md §7's "Customer
 * panel" fields (name, phone, email, address with a map link, order
 * count, total spent, internal notes), plus docs/10 §7's COD-block toggle.
 * `id` is `Customer.id`, same "admin routes key off internal ids" pattern
 * as `admin/orders/[id]`.
 */
export default async function AdminCustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { id } = await params;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "customer:view");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect(`/auth/login?callbackUrl=/admin/customers/${id}`);
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  let customer;
  try {
    customer = await getCustomerForAdmin(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const canUpdate = (session?.user.permissionKeys ?? []).includes("customer:update");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-headline-md text-on-surface">
            {customer.name ?? "Unnamed customer"}
          </h1>
          {customer.codBlocked && <Badge variant="danger">COD blocked</Badge>}
          {customer.tags.map((tag) => (
            <Badge key={tag} variant="glass">
              {tag}
            </Badge>
          ))}
        </div>
        <p className="text-body-sm text-on-surface-variant">
          {[customer.phone, customer.email].filter(Boolean).join(" · ") ||
            "No contact details on file"}
          {" · Customer since "}
          {formatRelativeTime(customer.createdAt)}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card variant="surface">
          <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
            <p className="text-body-sm text-on-surface-variant">Orders</p>
            <p className="text-headline-sm text-on-surface">{customer.totalOrders}</p>
          </CardContent>
        </Card>
        <Card variant="surface">
          <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
            <p className="text-body-sm text-on-surface-variant">Total spent</p>
            <p className="text-headline-sm text-on-surface">
              {formatNPR(customer.totalSpentPaisa)}
            </p>
          </CardContent>
        </Card>
        <Card variant="surface">
          <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
            <p className="text-body-sm text-on-surface-variant">Last order</p>
            <p className="text-headline-sm text-on-surface">
              {customer.lastOrderAt ? formatRelativeTime(customer.lastOrderAt) : "Never ordered"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card variant="surface">
        <CardContent className="flex flex-col gap-3 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">Cash on Delivery</h2>
          <p className="text-body-sm text-on-surface-variant">
            Blocking a customer here stops them from choosing Cash on Delivery at checkout — they
            can still pay by bank transfer or another method.
          </p>
          <CodBlockToggle
            customerId={customer.id}
            codBlocked={customer.codBlocked}
            canUpdate={canUpdate}
          />
        </CardContent>
      </Card>

      <Card variant="surface">
        <CardContent className="flex flex-col gap-3 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">Notes</h2>
          <p className="text-body-sm text-on-surface-variant">
            Only your team can see this — customers never see it.
          </p>
          <CustomerNotes
            customerId={customer.id}
            initialNotes={customer.notes}
            canUpdate={canUpdate}
          />
        </CardContent>
      </Card>

      <Card variant="surface">
        <CardContent className="flex flex-col gap-3 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">Addresses</h2>
          {customer.addresses.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No saved addresses.</p>
          ) : (
            <ul className="flex flex-col gap-4">
              {customer.addresses.map((address) => (
                <li key={address.id} className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <p className="text-body-md font-medium text-on-surface">{address.fullName}</p>
                    {address.isDefault && <Badge variant="glass">Default</Badge>}
                  </div>
                  <p className="text-body-sm text-on-surface-variant">{address.phone}</p>
                  <p className="text-body-sm text-on-surface-variant">
                    {address.streetAddress}, {address.municipality}
                    {address.ward ? ` (Ward ${address.ward})` : ""}, {address.district}
                  </p>
                  <a
                    href={mapLink(address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-body-sm text-primary hover:underline"
                  >
                    Open in Maps
                  </a>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card variant="surface">
        <CardContent className="flex flex-col gap-3 pt-[--space-card-padding]">
          <h2 className="text-body-lg font-medium text-on-surface">Recent orders</h2>
          {customer.recentOrders.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No orders yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-glass-stroke">
              {customer.recentOrders.map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="text-body-md font-medium text-on-surface hover:underline"
                    >
                      {order.orderNumber}
                    </Link>
                    <p className="text-body-sm text-on-surface-variant">
                      {statusLabel(order.status)}
                    </p>
                  </div>
                  <p className="text-body-md text-on-surface">{formatNPR(order.totalPaisa)}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
