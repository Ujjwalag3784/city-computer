import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { formatNPR } from "@/lib/money";
import { formatRelativeTime } from "@/lib/date";
import {
  REPORT_RANGE_OPTIONS,
  getSalesReport,
  getTopProductsReport,
  getInventoryReport,
  getSearchGapsReport,
  type ReportRange,
} from "@/server/services/admin/reports";

export const metadata: Metadata = { title: "Reports — Admin — City Computer Systems" };

const RANGE_VALUES = REPORT_RANGE_OPTIONS.map((o) => o.value);

function isReportRange(value: string): value is ReportRange {
  return (RANGE_VALUES as string[]).includes(value);
}

/**
 * `/admin/reports` — docs/09-ADMIN-DAD-MODE.md §3 ("Reports" — OWNER,
 * MANAGER) and docs/17's Phase 9 "sales, products, inventory, search
 * gaps" deliverable list, in that order. Every number links to the list
 * behind it, same acceptance bar as the Today dashboard.
 */
export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "report:view");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/reports");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawRange = typeof params.range === "string" ? params.range : "7d";
  const range: ReportRange = isReportRange(rawRange) ? rawRange : "7d";

  const [sales, topProducts, inventory, searchGaps] = await Promise.all([
    getSalesReport(range),
    getTopProductsReport(range),
    getInventoryReport(),
    getSearchGapsReport(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Reports</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Sales, your best-selling products, stock levels, and what people searched for but
          couldn&apos;t find.
        </p>
      </div>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Time period">
        {REPORT_RANGE_OPTIONS.map((option) => (
          <Link
            key={option.value}
            href={`/admin/reports?range=${option.value}`}
            aria-current={range === option.value ? "true" : undefined}
            className={
              range === option.value
                ? "rounded-full border border-primary-container bg-primary-container px-3 py-1.5 text-body-sm text-on-primary-container"
                : "rounded-full border border-glass-stroke px-3 py-1.5 text-body-sm text-on-surface-variant hover:border-primary-container hover:text-on-surface"
            }
          >
            {option.label}
          </Link>
        ))}
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-body-lg font-medium text-on-surface">Sales — {sales.rangeLabel}</h2>
        <div className="grid gap-4 sm:grid-cols-4">
          <Card variant="surface">
            <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
              <p className="text-body-sm text-on-surface-variant">Orders</p>
              <Link
                href="/admin/orders"
                className="text-headline-sm text-on-surface hover:underline"
              >
                {sales.ordersCount}
              </Link>
            </CardContent>
          </Card>
          <Card variant="surface">
            <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
              <p className="text-body-sm text-on-surface-variant">Revenue</p>
              <p className="text-headline-sm text-on-surface">{formatNPR(sales.revenuePaisa)}</p>
            </CardContent>
          </Card>
          <Card variant="surface">
            <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
              <p className="text-body-sm text-on-surface-variant">Average order value</p>
              <p className="text-headline-sm text-on-surface">{formatNPR(sales.aovPaisa)}</p>
            </CardContent>
          </Card>
          <Card variant="surface">
            <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
              <p className="text-body-sm text-on-surface-variant">Cancelled</p>
              <Link
                href="/admin/orders?filter=cancelled"
                className="text-headline-sm text-on-surface hover:underline"
              >
                {sales.cancelledCount}
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-body-lg font-medium text-on-surface">
          Best-selling products — {sales.rangeLabel}
        </h2>
        {topProducts.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">No sales in this period yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-glass-stroke rounded-xl border border-glass-stroke">
            {topProducts.map((row) => (
              <li key={row.productId} className="flex items-center justify-between gap-4 p-4">
                <Link
                  href={`/admin/products/${row.productId}/edit`}
                  className="text-body-md text-on-surface hover:underline"
                >
                  {row.productName}
                </Link>
                <div className="flex items-center gap-4 text-body-sm text-on-surface-variant">
                  <span>{row.quantitySold} sold</span>
                  <span>{formatNPR(row.revenuePaisa)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-body-lg font-medium text-on-surface">Stock</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card variant="surface">
            <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
              <p className="text-body-sm text-on-surface-variant">Almost out of stock</p>
              <Link
                href="/admin/inventory?filter=low-stock"
                className="text-headline-sm text-on-surface hover:underline"
              >
                {inventory.lowStockCount}
              </Link>
            </CardContent>
          </Card>
          <Card variant="surface">
            <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
              <p className="text-body-sm text-on-surface-variant">Out of stock</p>
              <Link
                href="/admin/inventory?filter=out-of-stock"
                className="text-headline-sm text-on-surface hover:underline"
              >
                {inventory.outOfStockCount}
              </Link>
            </CardContent>
          </Card>
        </div>
        {inventory.topLowStock.length > 0 && (
          <ul className="flex flex-col divide-y divide-glass-stroke rounded-xl border border-glass-stroke">
            {inventory.topLowStock.map((item) => (
              <li key={item.productName} className="flex items-center justify-between gap-4 p-4">
                <span className="text-body-md text-on-surface">{item.productName}</span>
                <span className="text-body-sm text-on-surface-variant">
                  {item.quantity} left (warns at {item.lowStockThreshold})
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-body-lg font-medium text-on-surface">
          What people searched for and didn&apos;t find
        </h2>
        <p className="text-body-sm text-on-surface-variant">
          You might want to stock these, or add them as search keywords on a similar product. Last
          30 days.
        </p>
        {searchGaps.length === 0 ? (
          <p className="text-body-sm text-on-surface-variant">
            Nothing to show — every search found something.
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-glass-stroke rounded-xl border border-glass-stroke">
            {searchGaps.map((row) => (
              <li key={row.query} className="flex items-center justify-between gap-4 p-4">
                <a
                  href={`/en/search?q=${encodeURIComponent(row.query)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-body-md text-on-surface hover:underline"
                >
                  {row.query}
                </a>
                <div className="flex items-center gap-3 text-body-sm text-on-surface-variant">
                  <Badge variant="glass">{row.searchCount}x</Badge>
                  <span>{formatRelativeTime(row.lastSearchedAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
