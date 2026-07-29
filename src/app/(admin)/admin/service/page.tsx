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
import { formatRelativeTime } from "@/lib/date";
import { TicketStatus } from "@/generated/prisma/client";
import { adminTicketListQuerySchema } from "@/lib/validation/admin/service-tickets";
import {
  listTicketsForAdmin,
  type AdminTicketListItem,
} from "@/server/services/admin/service-tickets";
import { LearnMoreLink } from "@/components/admin/learn-more-link";

export const metadata: Metadata = { title: "Repair jobs — Admin — City Computer Systems" };

const TICKET_FILTER_OPTIONS = [
  { value: "needs-attention", label: "Needs attention" },
  { value: "ready-for-pickup", label: "Ready for pickup" },
  { value: "collected", label: "Collected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

const STATUS_BADGE_VARIANT: Record<string, "primary" | "success" | "warning" | "danger" | "glass"> =
  {
    [TicketStatus.RECEIVED]: "glass",
    [TicketStatus.DIAGNOSING]: "primary",
    [TicketStatus.QUOTE_SENT]: "primary",
    [TicketStatus.AWAITING_APPROVAL]: "warning",
    [TicketStatus.APPROVED]: "primary",
    [TicketStatus.DECLINED]: "danger",
    [TicketStatus.IN_REPAIR]: "primary",
    [TicketStatus.AWAITING_PARTS]: "warning",
    [TicketStatus.READY_FOR_PICKUP]: "success",
    [TicketStatus.COLLECTED]: "success",
    [TicketStatus.CANCELLED]: "danger",
  };

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

/** `/admin/service` — docs/09-ADMIN-DAD-MODE.md §3 ("Repair jobs" — OWNER, MANAGER, TECHNICIAN, STAFF). */
export default async function AdminServicePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "service-ticket:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/service");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawPage = typeof params.page === "string" ? Number(params.page) : undefined;
  const query = adminTicketListQuerySchema.parse({
    q: typeof params.q === "string" ? params.q : undefined,
    filter: typeof params.filter === "string" ? params.filter : undefined,
    page: Number.isFinite(rawPage) ? rawPage : undefined,
  });

  const result = await listTicketsForAdmin(query);

  const columns: DataTableColumn<AdminTicketListItem>[] = [
    {
      key: "ticketNumber",
      header: "Job",
      render: (row) => (
        <Link
          href={`/admin/service/${row.id}`}
          className="font-medium text-on-surface hover:underline"
        >
          {row.ticketNumber}
        </Link>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      render: (row) => (
        <div className="flex flex-col">
          <span>{row.name}</span>
          <span className="text-body-sm text-on-surface-variant">{row.phone}</span>
        </div>
      ),
    },
    {
      key: "device",
      header: "Device",
      render: (row) => (
        <span>
          {row.brand} {row.model ?? ""}
        </span>
      ),
    },
    { key: "branch", header: "Branch", render: (row) => row.branchName },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={STATUS_BADGE_VARIANT[row.status] ?? "glass"}>
          {statusLabel(row.status)}
        </Badge>
      ),
    },
    {
      key: "receivedAt",
      header: "Received",
      render: (row) => (
        <time
          dateTime={row.receivedAt.toISOString()}
          className="text-body-sm text-on-surface-variant"
        >
          {formatRelativeTime(row.receivedAt)}
        </time>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-md text-on-surface">Repair jobs</h1>
          <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
            Every device your team is fixing, from drop-off to pickup.
          </p>
          <LearnMoreLink slug="managing-repair-jobs" />
        </div>
        <Button asChild>
          <Link href="/admin/service/new">+ New repair job</Link>
        </Button>
      </div>

      <AdminSearchBox
        initialValue={query.q ?? ""}
        placeholder="Search job number, name, or phone..."
      />
      <AdminFilterChips
        options={TICKET_FILTER_OPTIONS}
        active={query.filter}
        basePath="/admin/service"
        defaultValue="needs-attention"
        q={query.q}
      />

      <DataTable
        columns={columns}
        rows={result.items}
        getRowId={(row) => row.id}
        emptyMessage="No repair jobs match this view."
      />

      <div className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {result.total} repair job{result.total === 1 ? "" : "s"}
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
  if (query.filter !== "needs-attention") params.set("filter", query.filter);
  params.set("page", String(page));
  return `/admin/service?${params.toString()}`;
}
