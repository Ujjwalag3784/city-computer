import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ContentSubNav } from "@/components/admin/content-sub-nav";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listPagesForAdmin, type AdminPageListItem } from "@/server/services/admin/pages";

export const metadata: Metadata = { title: "Pages — Admin — City Computer Systems" };

/** `/admin/pages` — docs/17 Phase 10: "CMS pages with templates." */
export default async function AdminPagesPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "page:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/pages");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const pages = await listPagesForAdmin();

  const columns: DataTableColumn<AdminPageListItem>[] = [
    {
      key: "title",
      header: "Title",
      render: (row) => (
        <Link
          href={`/admin/pages/${row.id}`}
          className="font-medium text-on-surface hover:underline"
        >
          {row.title}
        </Link>
      ),
    },
    { key: "slug", header: "URL", render: (row) => `/pages/${row.slug}` },
    { key: "template", header: "Template", render: (row) => row.template },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <Badge variant={row.status === "PUBLISHED" ? "success" : "glass"}>{row.status}</Badge>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <ContentSubNav active="pages" />
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-md text-on-surface">Pages</h1>
          <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
            About, contact, and policy pages. Published pages show up at /pages/&lt;slug&gt;.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/pages/new">Add a page</Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={pages}
        getRowId={(row) => row.id}
        emptyMessage="No pages yet."
      />
    </div>
  );
}
