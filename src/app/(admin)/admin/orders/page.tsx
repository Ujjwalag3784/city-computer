import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { AdminSearchBox } from "@/components/admin/admin-search-box";
import { AdminFilterChips } from "@/components/admin/admin-filter-chips";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { formatNPR } from "@/lib/money";
import { formatRelativeTime } from "@/lib/date";
import { adminOrderListQuerySchema } from "@/lib/validation/admin/orders";
import { listOrdersForAdmin, type AdminOrderListItem } from "@/server/services/admin/orders";

export const metadata: Metadata = {
  title: "Orders — Admin — City Computer Systems",
};

const ORDER_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "needs-review", label: "Needs payment review" },
  { value: "paid-not-sent", label: "Paid, not sent" },
  { value: "cancelled", label: "Cancelled" },
];

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

/**
 * `/admin/orders` — docs/17-ROADMAP-PHASES.md Phase 7's admin order
 * management dashboard, the destination `admin/dashboard.ts`'s "bank
 * transfer payments waiting" and "paid but not sent" tasks already link
 * to (`?paymentMethod=bank_transfer&needsReview=true`, `?filter=paid-not-
 * sent`) — both query shapes are handled here so those links, live since
 * the dashboard was built, finally resolve to a real page.
 */
export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "order:view");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/orders");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawPage = typeof params.page === "string" ? Number(params.page) : undefined;
  // The dashboard's own links use `needsReview=true` (paired with
  // `paymentMethod=bank_transfer`) rather than `filter=needs-review` —
  // both are accepted and folded onto the same `filter` value here so
  // either URL shape lands on the same filtered view.
  const rawFilter =
    params.needsReview === "true"
      ? "needs-review"
      : typeof params.filter === "string"
        ? params.filter
        : undefined;
  const query = adminOrderListQuerySchema.parse({
    q: typeof params.q === "string" ? params.q : undefined,
    filter: rawFilter,
    paymentMethod: typeof params.paymentMethod === "string" ? params.paymentMethod : undefined,
    page: Number.isFinite(rawPage) ? rawPage : undefined,
  });

  const result = await listOrdersForAdmin(query);

  const columns: DataTableColumn<AdminOrderListItem>[] = [
    {
      key: "orderNumber",
      header: "Order",
      render: (row) => (
        <Link
          href={`/admin/orders/${row.id}`}
          className="font-medium text-on-surface hover:underline"
        >
          {row.orderNumber}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <div className="flex flex-col">
          <span>{row.customerName ?? "Guest"}</span>
          {row.phone && <span className="text-body-sm text-on-surface-variant">{row.phone}</span>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={STATUS_BADGE_VARIANT[row.status] ?? "glass"}>
            {statusLabel(row.status)}
          </Badge>
          {row.needsReview && <Badge variant="warning">Needs review</Badge>}
        </div>
      ),
    },
    {
      key: "payment",
      header: "Payment",
      render: (row) => (
        <span className="text-body-sm text-on-surface-variant">
          {row.paymentProvider === "COD"
            ? "Cash on Delivery"
            : row.paymentProvider === "BANK_TRANSFER"
              ? "Bank Transfer"
              : "—"}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => formatNPR(row.totalPaisa),
    },
    {
      key: "placedAt",
      header: "Placed",
      render: (row) => (
        <time
          dateTime={row.placedAt.toISOString()}
          className="text-body-sm text-on-surface-variant"
        >
          {formatRelativeTime(row.placedAt)}
        </time>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Orders</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Every order placed on the site — check payments, move an order forward, or step in when
          something needs a human decision.
        </p>
      </div>

      <AdminSearchBox
        initialValue={query.q ?? ""}
        placeholder="Search order number, phone, or customer..."
      />
      <AdminFilterChips
        options={ORDER_FILTER_OPTIONS}
        active={query.filter}
        basePath="/admin/orders"
        q={query.q}
      />

      <DataTable
        columns={columns}
        rows={result.items}
        getRowId={(row) => row.id}
        emptyMessage="No orders match this view."
      />

      <div className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {result.total} order{result.total === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          {query.page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(query, query.page - 1)}>Previous</Link>
            </Button>
          )}
          {result.hasNext && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(query, query.page + 1)}>Next</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function pageHref(
  query: { q?: string; filter: string; paymentMethod?: string },
  page: number,
): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.filter !== "all") params.set("filter", query.filter);
  if (query.paymentMethod) params.set("paymentMethod", query.paymentMethod);
  params.set("page", String(page));
  return `/admin/orders?${params.toString()}`;
}
