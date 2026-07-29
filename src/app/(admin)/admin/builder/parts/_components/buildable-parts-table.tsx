"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import type { AdminBuildablePartRow } from "@/server/services/admin/builder-parts";
import type { PartDataConfidence } from "@/generated/prisma/client";

export interface BuildablePartsTableProps {
  rows: AdminBuildablePartRow[];
}

const CONFIDENCE_BADGE_VARIANT: Record<PartDataConfidence, "success" | "warning" | "danger"> = {
  VERIFIED: "success",
  INFERRED: "warning",
  UNVERIFIED: "danger",
};

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * `"use client"` wrapper composing the generic `DataTable` — same pattern
 * `InventoryTable` establishes (`admin/inventory/_components/
 * inventory-table.tsx`): the page (Server Component) fetches `rows` and
 * hands them here; this file owns the `DataTableColumn` render functions,
 * which can't cross the Server -> Client boundary as props.
 */
export function BuildablePartsTable({ rows }: BuildablePartsTableProps) {
  const columns: DataTableColumn<AdminBuildablePartRow>[] = [
    { key: "partType", header: "Part type", render: (row) => humanize(row.partType) },
    { key: "manufacturer", header: "Manufacturer", render: (row) => row.manufacturer },
    { key: "model", header: "Model", render: (row) => row.model },
    {
      key: "performanceTier",
      header: "Tier",
      align: "right",
      render: (row) => `${row.performanceTier}/10`,
    },
    {
      key: "dataConfidence",
      header: "Confidence",
      render: (row) => (
        <Badge variant={CONFIDENCE_BADGE_VARIANT[row.dataConfidence]}>
          {humanize(row.dataConfidence)}
        </Badge>
      ),
    },
    {
      key: "isSellable",
      header: "Sellable",
      render: (row) => (row.isSellable ? "Yes" : "Informational only"),
    },
    {
      key: "isActive",
      header: "Active",
      render: (row) => (row.isActive ? "Yes" : "No"),
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={rows}
      getRowId={(row) => row.id}
      emptyMessage="No parts match this filter."
    />
  );
}
