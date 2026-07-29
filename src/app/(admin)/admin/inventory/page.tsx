import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AdminSearchBox } from "@/components/admin/admin-search-box";
import { AdminFilterChips } from "@/components/admin/admin-filter-chips";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { stockListQuerySchema } from "@/lib/validation/admin/inventory";
import { listStockForAdmin } from "@/server/services/admin/inventory";
import { InventoryTable } from "./_components/inventory-table";
import { LearnMoreLink } from "@/components/admin/learn-more-link";

export const metadata: Metadata = {
  title: "Stock — Admin — City Computer Systems",
};

const STOCK_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "low-stock", label: "Almost out of stock" },
  { value: "out-of-stock", label: "Out of stock" },
];

/**
 * `/admin/inventory` — docs/09-ADMIN-DAD-MODE.md §3's "Stock" module
 * (OWNER, MANAGER, STAFF). The dedicated stock screen §6 describes:
 * search, a low-stock filter, per-row `−1`/`+1`/"Set…" quick actions
 * (`StockAdjuster`, wired for the first time this pass), a "Stock
 * history" timeline per product, and bulk update. Spreadsheet upload and
 * the daily low-stock email are NOT built — see `server/services/admin/
 * inventory.ts`'s own header comment for why.
 */
export default async function AdminInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "stock:update");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/inventory");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawPage = typeof params.page === "string" ? Number(params.page) : undefined;
  const query = stockListQuerySchema.parse({
    q: typeof params.q === "string" ? params.q : undefined,
    filter: typeof params.filter === "string" ? params.filter : undefined,
    page: Number.isFinite(rawPage) ? rawPage : undefined,
  });

  const result = await listStockForAdmin(query);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Stock</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          This is where you check and change how much of each product you have. Every change here is
          recorded, with who made it and why.
        </p>
        <LearnMoreLink slug="understanding-stock" />
      </div>

      <AdminSearchBox
        initialValue={query.q ?? ""}
        placeholder="Search products or product codes..."
      />
      <AdminFilterChips
        options={STOCK_FILTER_OPTIONS}
        active={query.filter}
        basePath="/admin/inventory"
        q={query.q}
      />

      <InventoryTable rows={result.items} />

      <div className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {result.total} product{result.total === 1 ? "" : "s"}
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
  return `/admin/inventory?${params.toString()}`;
}
