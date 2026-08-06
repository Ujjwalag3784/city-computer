import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTableStatic, type DataTableColumn } from "@/components/admin/data-table-static";
import { AdminSearchBox } from "@/components/admin/admin-search-box";
import { AdminFilterChips } from "@/components/admin/admin-filter-chips";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { formatNPR } from "@/lib/money";
import { formatRelativeTime } from "@/lib/date";
import { adminCustomerListQuerySchema } from "@/lib/validation/admin/customers";
import {
  listCustomersForAdmin,
  type AdminCustomerListItem,
} from "@/server/services/admin/customers";

export const metadata: Metadata = {
  title: "Customers — Admin — City Computer Systems",
};

const CUSTOMER_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "cod-blocked", label: "Cash on Delivery blocked" },
  { value: "new-this-week", label: "New this week" },
];

/**
 * `/admin/customers` — docs/09-ADMIN-DAD-MODE.md §3 ("Customers" — OWNER,
 * MANAGER, SUPPORT) and §12 (SUPPORT "can view orders and customers").
 * Same list-page shape as `admin/orders/page.tsx`: search box, filter
 * chips, `DataTable`, pagination — reused deliberately, not reinvented.
 */
export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "customer:view");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/customers");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawPage = typeof params.page === "string" ? Number(params.page) : undefined;
  const query = adminCustomerListQuerySchema.parse({
    q: typeof params.q === "string" ? params.q : undefined,
    filter: typeof params.filter === "string" ? params.filter : undefined,
    page: Number.isFinite(rawPage) ? rawPage : undefined,
  });

  const result = await listCustomersForAdmin(query);

  const columns: DataTableColumn<AdminCustomerListItem>[] = [
    {
      key: "name",
      header: "Customer",
      render: (row) => (
        <Link
          href={`/admin/customers/${row.id}`}
          className="font-medium text-on-surface hover:underline"
        >
          {row.name ?? "Unnamed customer"}
        </Link>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      render: (row) => (
        <div className="flex flex-col">
          {row.phone && <span className="text-body-sm text-on-surface-variant">{row.phone}</span>}
          {row.email && <span className="text-body-sm text-on-surface-variant">{row.email}</span>}
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          {row.codBlocked && <Badge variant="danger">COD blocked</Badge>}
          {row.tags.map((tag) => (
            <Badge key={tag} variant="glass">
              {tag}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      key: "orders",
      header: "Orders",
      align: "right",
      render: (row) => row.totalOrders,
    },
    {
      key: "spent",
      header: "Total spent",
      align: "right",
      render: (row) => formatNPR(row.totalSpentPaisa),
    },
    {
      key: "lastOrder",
      header: "Last order",
      render: (row) =>
        row.lastOrderAt ? (
          <time
            dateTime={row.lastOrderAt.toISOString()}
            className="text-body-sm text-on-surface-variant"
          >
            {formatRelativeTime(row.lastOrderAt)}
          </time>
        ) : (
          <span className="text-body-sm text-on-surface-variant">No orders yet</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Customers</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Everyone who has an account or has ordered from the website. Open a customer to see their
          orders, addresses, and any notes your team has left.
        </p>
      </div>

      <AdminSearchBox initialValue={query.q ?? ""} placeholder="Search name, phone, or email..." />
      <AdminFilterChips
        options={CUSTOMER_FILTER_OPTIONS}
        active={query.filter}
        basePath="/admin/customers"
        q={query.q}
      />

      <DataTableStatic
        columns={columns}
        rows={result.items}
        getRowId={(row) => row.id}
        emptyMessage="No customers match this view."
      />

      <div className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {result.total} customer{result.total === 1 ? "" : "s"}
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

function pageHref(query: { q?: string; filter: string }, page: number): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.filter !== "all") params.set("filter", query.filter);
  params.set("page", String(page));
  return `/admin/customers?${params.toString()}`;
}
