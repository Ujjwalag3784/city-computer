"use client";

import { useState } from "react";
import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/admin/data-table";
import { StockLevelBar } from "@/components/admin/stock-level-bar";
import type { AdminStockRow } from "@/server/services/admin/inventory";
import { StockAdjusterCell } from "./stock-adjuster-cell";
import { StockHistoryDialog } from "./stock-history-dialog";
import { BulkStockDialog } from "./bulk-stock-dialog";

/**
 * `/admin/inventory`'s table shell — owns row-selection state (for the
 * bulk-update dialog) and which row's stock-history dialog, if any, is
 * open. Everything else (the search box, filter chips, and the rows
 * themselves) is server-rendered by `page.tsx`; this is the one client
 * island the row-level quick actions and bulk selection need.
 */
export function InventoryTable({ rows }: { rows: AdminStockRow[] }) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [historyRow, setHistoryRow] = useState<AdminStockRow | null>(null);

  const columns: DataTableColumn<AdminStockRow>[] = [
    {
      key: "product",
      header: "Product",
      render: (row) => (
        <div className="flex flex-col">
          <span className="font-medium text-on-surface">{row.productName}</span>
          <span className="text-body-sm text-on-surface-variant">
            {row.brandName} · {row.productCode}
          </span>
        </div>
      ),
    },
    {
      key: "reserved",
      header: "Reserved",
      align: "right",
      render: (row) => <span className="text-on-surface-variant">{row.reservedQuantity}</span>,
    },
    {
      key: "available",
      header: "Available",
      align: "right",
      render: (row) => (
        <StockLevelBar quantity={row.availableQuantity} lowStockThreshold={row.lowStockThreshold} />
      ),
    },
    {
      key: "stock",
      header: "Stock",
      render: (row) => <StockAdjusterCell variantId={row.variantId} quantity={row.quantity} />,
    },
    {
      key: "history",
      header: "",
      render: (row) => (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setHistoryRow(row)}
          aria-label={`See stock history for ${row.productName}`}
        >
          <History className="size-4" />
          History
        </Button>
      ),
    },
  ];

  const selectedRows = rows.filter((row) => selectedIds.includes(row.variantId));

  return (
    <div className="flex flex-col gap-4">
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-glass-stroke bg-surface-container p-3">
          <span className="text-body-sm text-on-surface">
            {selectedIds.length} product{selectedIds.length === 1 ? "" : "s"} selected
          </span>
          <Button type="button" size="sm" onClick={() => setBulkOpen(true)}>
            Update stock for {selectedIds.length}
          </Button>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.variantId}
        selectable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        emptyMessage="No products found."
      />

      <BulkStockDialog
        open={bulkOpen}
        onOpenChange={(open) => {
          setBulkOpen(open);
          if (!open) setSelectedIds([]);
        }}
        rows={selectedRows.map((row) => ({
          variantId: row.variantId,
          productName: row.productName,
          quantity: row.quantity,
        }))}
      />

      {historyRow && (
        <StockHistoryDialog
          open
          onOpenChange={() => setHistoryRow(null)}
          variantId={historyRow.variantId}
          productName={historyRow.productName}
        />
      )}
    </div>
  );
}
