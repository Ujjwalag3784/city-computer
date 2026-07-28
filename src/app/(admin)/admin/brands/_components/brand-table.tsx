"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import type { AdminBrandRow } from "@/server/services/admin/brand";
import { deleteBrandAction } from "../_actions";
import { BrandFormDialog } from "./brand-form-dialog";

export interface BrandTableProps {
  brands: AdminBrandRow[];
}

export function BrandTable({ brands }: BrandTableProps) {
  const [formTarget, setFormTarget] = useState<{ brand?: AdminBrandRow } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminBrandRow | null>(null);
  const [isDeleting, startDeleteTransition] = useTransition();
  const router = useRouter();

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    startDeleteTransition(async () => {
      const result = await deleteBrandAction(target.id);
      if (!result.ok) {
        toast.error(result.message ?? "Couldn't delete this brand.");
        return;
      }
      toast(`Deleted "${target.name}".`);
      router.refresh();
    });
  }

  const columns: DataTableColumn<AdminBrandRow>[] = [
    {
      key: "name",
      header: "Brand",
      render: (row) => (
        <div className="flex items-center gap-2">
          <span className="text-body-lg text-on-surface">{row.name}</span>
          {row.isFeatured && <Badge variant="primary">Featured</Badge>}
        </div>
      ),
    },
    {
      key: "website",
      header: "Website",
      render: (row) =>
        row.website ? (
          <a
            href={row.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-body-sm text-primary hover:underline"
          >
            {row.website.replace(/^https?:\/\//, "")}
            <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ) : (
          <span className="text-body-sm text-on-surface-variant">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (row) =>
        row.isActive ? (
          <Badge variant="success">Live</Badge>
        ) : (
          <Badge variant="warning">Not published yet</Badge>
        ),
    },
    {
      key: "productCount",
      header: "Products",
      align: "right",
      render: (row) => <span className="text-body-lg text-on-surface">{row.productCount}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (row) => (
        <div className="flex justify-end gap-1">
          <Button
            variant="icon"
            size="sm"
            iconOnly
            aria-label={`Edit ${row.name}`}
            onClick={() => setFormTarget({ brand: row })}
          >
            <Pencil />
          </Button>
          <Button
            variant="icon"
            size="sm"
            iconOnly
            aria-label={`Delete ${row.name}`}
            onClick={() => setDeleteTarget(row)}
          >
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <Button onClick={() => setFormTarget({})}>
          <Plus />
          Add a brand
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={brands}
        getRowId={(row) => row.id}
        emptyMessage="You haven't added any brands yet."
      />

      <BrandFormDialog
        open={formTarget !== null}
        onOpenChange={(open) => !open && setFormTarget(null)}
        brand={formTarget?.brand}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this brand?"
        itemName={deleteTarget?.name ?? ""}
        consequence="This can't be undone. Brands with products can't be deleted."
        confirmLabel={isDeleting ? "Deleting…" : "Yes, delete it"}
        onConfirm={handleConfirmDelete}
        variant="destructive"
      />
    </div>
  );
}
