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
import { adminCampaignListQuerySchema } from "@/lib/validation/admin/campaigns";
import {
  listCampaignsForAdmin,
  type AdminCampaignListItem,
} from "@/server/services/admin/campaigns";
import { CampaignActiveToggle } from "./_components/campaign-active-toggle";

export const metadata: Metadata = { title: "Offers & banners — Admin — City Computer Systems" };

const CAMPAIGN_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "active", label: "Live" },
  { value: "inactive", label: "Turned off" },
];

function typeLabel(type: string): string {
  return type
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

/** `/admin/campaigns` — docs/09 §3's "Offers & banners". See `admin/campaigns.ts`'s doc comment for what this screen deliberately does not cover yet (per-campaign targeting rules). */
export default async function AdminCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "promotion:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/campaigns");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const rawPage = typeof params.page === "string" ? Number(params.page) : undefined;
  const query = adminCampaignListQuerySchema.parse({
    q: typeof params.q === "string" ? params.q : undefined,
    filter: typeof params.filter === "string" ? params.filter : undefined,
    page: Number.isFinite(rawPage) ? rawPage : undefined,
  });

  const result = await listCampaignsForAdmin(query);

  const columns: DataTableColumn<AdminCampaignListItem>[] = [
    {
      key: "name",
      header: "Campaign",
      render: (row) => (
        <Link
          href={`/admin/campaigns/${row.id}`}
          className="font-medium text-on-surface hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    { key: "type", header: "Type", render: (row) => typeLabel(row.type) },
    { key: "priority", header: "Priority", align: "right", render: (row) => row.priority },
    {
      key: "rules",
      header: "Set up",
      render: (row) =>
        row.ruleCount > 0 ? (
          <Badge variant="success">Configured</Badge>
        ) : (
          <Badge variant="warning">Needs setup</Badge>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={row.isActive ? "success" : "glass"}>{row.isActive ? "Live" : "Off"}</Badge>
      ),
    },
    {
      key: "toggle",
      header: "",
      render: (row) => <CampaignActiveToggle campaignId={row.id} isActive={row.isActive} />,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-md text-on-surface">Offers & banners</h1>
          <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
            Automatic discounts that apply without a code. A campaign marked &ldquo;Needs
            setup&rdquo; won&apos;t discount anything yet — ask a developer to finish wiring it up.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/campaigns/new">Add a campaign</Link>
        </Button>
      </div>

      <AdminSearchBox initialValue={query.q ?? ""} placeholder="Search campaign name..." />
      <AdminFilterChips
        options={CAMPAIGN_FILTER_OPTIONS}
        active={query.filter}
        basePath="/admin/campaigns"
        q={query.q}
      />

      <DataTable
        columns={columns}
        rows={result.items}
        getRowId={(row) => row.id}
        emptyMessage="No campaigns yet."
      />

      <div className="flex items-center justify-between">
        <p className="text-body-sm text-on-surface-variant">
          {result.total} campaign{result.total === 1 ? "" : "s"}
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
  return `/admin/campaigns?${params.toString()}`;
}
