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
import { CouponType } from "@/generated/prisma/client";
import { adminCouponListQuerySchema } from "@/lib/validation/admin/coupons";
import { listCouponsForAdmin, type AdminCouponListItem } from "@/server/services/admin/coupons";
import { CouponActiveToggle } from "./_components/coupon-active-toggle";

export const metadata: Metadata = { title: "Discount codes — Admin — City Computer Systems" };

const COUPON_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Live" },
  { value: "inactive", label: "Turned off" },
  { value: "expired", label: "Expired" },
];

function valueLabel(coupon: AdminCouponListItem): string {
  if (coupon.type === CouponType.PERCENTAGE) return `${coupon.value}% off`;
  if (coupon.type === CouponType.FREE_SHIPPING) return "Free shipping";
  return `${formatNPR(coupon.value)} off`;
}

/**
 * `/admin/coupons` — docs/09-ADMIN-DAD-MODE.md §3 ("Discount codes" —
 * OWNER, MANAGER). Same list-page shape as `admin/orders`/`admin/customers`.
 */
export default async function AdminCouponsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "coupon:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/coupons");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawPage = typeof params.page === "string" ? Number(params.page) : undefined;
  const query = adminCouponListQuerySchema.parse({
    q: typeof params.q === "string" ? params.q : undefined,
    filter: typeof params.filter === "string" ? params.filter : undefined,
    page: Number.isFinite(rawPage) ? rawPage : undefined,
  });

  const result = await listCouponsForAdmin(query);

  const columns: DataTableColumn<AdminCouponListItem>[] = [
    {
      key: "code",
      header: "Code",
      render: (row) => (
        <Link
          href={`/admin/coupons/${row.id}`}
          className="font-medium text-on-surface hover:underline"
        >
          {row.code}
        </Link>
      ),
    },
    { key: "description", header: "Description", render: (row) => row.description ?? "—" },
    { key: "value", header: "Discount", render: (row) => valueLabel(row) },
    {
      key: "usage",
      header: "Used",
      align: "right",
      render: (row) =>
        row.usageLimit ? `${row.usedCount} / ${row.usageLimit}` : String(row.usedCount),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant={row.isActive ? "success" : "glass"}>
            {row.isActive ? "Live" : "Off"}
          </Badge>
          {row.endsAt && row.endsAt < new Date() && <Badge variant="warning">Expired</Badge>}
        </div>
      ),
    },
    {
      key: "toggle",
      header: "",
      render: (row) => <CouponActiveToggle couponId={row.id} isActive={row.isActive} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-md text-on-surface">Discount codes</h1>
          <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
            Codes customers type at checkout for money off. Turn one off any time without deleting
            it.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/coupons/new">Add a discount code</Link>
        </Button>
      </div>

      <AdminSearchBox initialValue={query.q ?? ""} placeholder="Search code or description..." />
      <AdminFilterChips
        options={COUPON_FILTER_OPTIONS}
        active={query.filter}
        basePath="/admin/coupons"
        q={query.q}
      />

      <DataTableStatic
        columns={columns}
        rows={result.items}
        getRowId={(row) => row.id}
        emptyMessage="No discount codes yet. Add your first one to get started."
      />

      <div className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {result.total} discount code{result.total === 1 ? "" : "s"}
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
  return `/admin/coupons?${params.toString()}`;
}
