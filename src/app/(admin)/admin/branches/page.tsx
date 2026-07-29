import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listBranchesForAdmin, type AdminBranchListItem } from "@/server/services/admin/branches";

export const metadata: Metadata = { title: "Stores — Admin — City Computer Systems" };

/** `/admin/branches` — docs/09-ADMIN-DAD-MODE.md §3 ("Stores" — OWNER only). */
export default async function AdminBranchesPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "branch:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/branches");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const branches = await listBranchesForAdmin();

  const columns: DataTableColumn<AdminBranchListItem>[] = [
    {
      key: "name",
      header: "Store",
      render: (row) => (
        <Link
          href={`/admin/branches/${row.id}`}
          className="font-medium text-on-surface hover:underline"
        >
          {row.name}
        </Link>
      ),
    },
    { key: "district", header: "District", render: (row) => row.district },
    { key: "phone", header: "Phone", render: (row) => row.phone },
    {
      key: "status",
      header: "Status",
      render: (row) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={row.isActive ? "success" : "glass"}>
            {row.isActive ? "Live" : "Off"}
          </Badge>
          {row.isDefaultFulfilment && <Badge variant="primary">Default</Badge>}
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-headline-md text-on-surface">Stores</h1>
          <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
            Your physical locations — where customers can pick up orders and where repairs happen.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/branches/new">Add a store</Link>
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={branches}
        getRowId={(row) => row.id}
        emptyMessage="No stores yet."
      />
    </div>
  );
}
