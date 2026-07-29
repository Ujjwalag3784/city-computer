import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AdminFilterChips } from "@/components/admin/admin-filter-chips";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listAuditLog } from "@/server/services/admin/audit-log";
import { toActivityHistoryRow } from "@/server/services/admin/activity";

export const metadata: Metadata = { title: "Activity History — Admin — City Computer Systems" };

const ENTITY_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "Order", label: "Orders" },
  { value: "Product", label: "Products" },
  { value: "Customer", label: "Customers" },
  { value: "Variant", label: "Stock" },
  { value: "Coupon", label: "Discount codes" },
  { value: "Review", label: "Reviews" },
  { value: "ServiceTicket", label: "Repair jobs" },
];

/**
 * `/admin/activity` — docs/09-ADMIN-DAD-MODE.md §13, Owner only. Every
 * admin mutation in this codebase already writes an `AuditLog` row
 * (`recordAuditLog`); this page is its first plain-language reader. See
 * `admin/activity.ts`'s own doc comment for what's a hand-tuned sentence
 * vs. a humanised fallback, and for the export feature this pass doesn't
 * build.
 */
export default async function AdminActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "audit:view");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/activity");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const entityType = typeof params.entityType === "string" ? params.entityType : "all";
  const page = typeof params.page === "string" && Number(params.page) > 0 ? Number(params.page) : 1;

  const result = await listAuditLog({
    entityType: entityType === "all" ? undefined : entityType,
    page,
  });
  const rows = result.items.map((entry) => toActivityHistoryRow(entry));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Activity History</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Every change anyone on your team has made, in plain English — who did it and when.
        </p>
      </div>

      <AdminFilterChips
        options={ENTITY_FILTER_OPTIONS}
        active={entityType}
        basePath="/admin/activity"
      />

      {rows.length === 0 ? (
        <p className="py-12 text-center text-body-lg text-on-surface-variant">Nothing here yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-glass-stroke rounded-xl border border-glass-stroke">
          {rows.map((row) => (
            <li key={row.id} className="flex flex-col gap-1 p-4">
              <p className="text-body-md text-on-surface">
                <span className="font-medium">{row.actorName}</span> {row.sentence}
              </p>
              {row.diff && <p className="text-body-sm text-on-surface-variant">{row.diff}</p>}
              <time
                dateTime={row.createdAt.toISOString()}
                className="text-label-mono-xs text-on-surface-variant"
              >
                {row.when}
              </time>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {result.total} event{result.total === 1 ? "" : "s"}
        </p>
        <div className="flex gap-2">
          {result.page > 1 && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(entityType, result.page - 1)}>Previous</Link>
            </Button>
          )}
          {result.hasNext && (
            <Button asChild variant="outline" size="sm">
              <Link href={pageHref(entityType, result.page + 1)}>Next</Link>
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function pageHref(entityType: string, page: number): string {
  const params = new URLSearchParams();
  if (entityType !== "all") params.set("entityType", entityType);
  params.set("page", String(page));
  return `/admin/activity?${params.toString()}`;
}
