"use client";

import * as React from "react";
import { ArrowUpDown, ChevronDown, ChevronUp } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * DataTable — docs/09-ADMIN-DAD-MODE.md §5.2 "Product list" (and the same
 * list-view shape reused across §3's whole admin route map — orders,
 * customers, products, etc.) describes every admin list screen as: a big
 * search box, filter chips, a table of rows with inline actions, and bulk
 * select. This component is only the generic **table engine** underneath
 * that contract — sortable columns, row selection, loading and empty
 * states. It deliberately does NOT build the search box, filter chips, or
 * bulk-action bar from §5.2: those are page-level composition, since each
 * admin list screen has its own domain-specific chip set (products vs.
 * orders vs. customers) and its own bulk actions sitting above a shared
 * `DataTable`. Per-row visuals that are also domain-specific — photo
 * thumbnails, coloured stock bars, status pills — are the caller's job too,
 * supplied via each `DataTableColumn`'s `render` function.
 *
 * docs/09 §11 accessibility: "16px base / 18px for form labels and table
 * content." `globals.css`'s type scale puts `text-body-md` at 16px and
 * `text-body-lg` at exactly 18px, so cell text below uses `text-body-lg`,
 * not the smaller `text-body-sm` default `Table` otherwise falls back to.
 * §11 also requires the admin stay usable at 200% browser zoom with no
 * horizontal scroll — the whole table sits inside an `overflow-x-auto`
 * wrapper here so a wide table scrolls horizontally instead of breaking
 * the page layout when zoomed.
 *
 * `"use client"`: sort-header clicks and selection checkboxes wire click/
 * change handlers directly onto elements in this file's own render tree.
 *
 * Loading: renders `SKELETON_ROW_COUNT` skeleton rows shaped like real rows
 * (one `Skeleton` per visible column, plus the selection checkbox column
 * when `selectable`) instead of `rows`, matching the loading-skeleton
 * convention already established by `product-grid.tsx` in
 * `src/components/commerce/` (skeletons matching final layout, never a
 * spinner over real content — docs/05-DESIGN-SYSTEM.md §7).
 */
export interface DataTableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortable?: boolean;
  /** Right-align numeric/price columns. */
  align?: "left" | "right" | "center";
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  onSortChange?: (key: string, direction: "asc" | "desc") => void;
  selectable?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

const ALIGN_CLASS: Record<"left" | "right" | "center", string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

const SKELETON_ROW_COUNT = 5;

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  sortKey,
  sortDirection,
  onSortChange,
  selectable = false,
  selectedIds = [],
  onSelectionChange,
  loading = false,
  emptyMessage = "No results.",
  className,
}: DataTableProps<T>) {
  const selectedSet = React.useMemo(() => new Set(selectedIds), [selectedIds]);
  const allRowIds = React.useMemo(() => rows.map(getRowId), [rows, getRowId]);
  const allSelected = allRowIds.length > 0 && allRowIds.every((id) => selectedSet.has(id));
  const someSelected = !allSelected && allRowIds.some((id) => selectedSet.has(id));
  const columnCount = columns.length + (selectable ? 1 : 0);

  function handleToggleAll(checked: boolean) {
    if (!onSelectionChange) return;
    if (checked) {
      const merged = new Set(selectedIds);
      for (const id of allRowIds) merged.add(id);
      onSelectionChange(Array.from(merged));
    } else {
      const remaining = selectedIds.filter((id) => !allRowIds.includes(id));
      onSelectionChange(remaining);
    }
  }

  function handleToggleRow(id: string, checked: boolean) {
    if (!onSelectionChange) return;
    if (checked) {
      onSelectionChange([...selectedIds, id]);
    } else {
      onSelectionChange(selectedIds.filter((existingId) => existingId !== id));
    }
  }

  function handleSortClick(column: DataTableColumn<T>) {
    if (!column.sortable || !onSortChange) return;
    const nextDirection: "asc" | "desc" =
      sortKey === column.key && sortDirection === "asc" ? "desc" : "asc";
    onSortChange(column.key, nextDirection);
  }

  return (
    <div className={cn("w-full overflow-x-auto rounded-xl border border-glass-stroke", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-12">
                <Checkbox
                  aria-label="Select all rows on this page"
                  checked={someSelected ? "indeterminate" : allSelected}
                  onCheckedChange={(checked) => handleToggleAll(checked === true)}
                  disabled={loading || allRowIds.length === 0}
                />
              </TableHead>
            )}
            {columns.map((column) => {
              const isActiveSort = sortKey === column.key;
              const SortIcon = isActiveSort
                ? sortDirection === "asc"
                  ? ChevronUp
                  : ChevronDown
                : ArrowUpDown;
              return (
                <TableHead key={column.key} className={ALIGN_CLASS[column.align ?? "left"]}>
                  {column.sortable ? (
                    <button
                      type="button"
                      onClick={() => handleSortClick(column)}
                      className={cn(
                        "inline-flex items-center gap-1 text-label-mono-xs text-on-surface-variant transition-colors hover:text-on-surface",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container",
                      )}
                    >
                      {column.header}
                      <SortIcon className="size-3.5" aria-hidden="true" />
                    </button>
                  ) : (
                    column.header
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading &&
            Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
              <TableRow key={index}>
                {selectable && (
                  <TableCell>
                    <Skeleton className="size-5 rounded-sm" />
                  </TableCell>
                )}
                {columns.map((column) => (
                  <TableCell key={column.key} className={ALIGN_CLASS[column.align ?? "left"]}>
                    <Skeleton className="h-5 w-full max-w-40" />
                  </TableCell>
                ))}
              </TableRow>
            ))}

          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columnCount}
                className="py-12 text-center text-body-lg text-on-surface-variant"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}

          {!loading &&
            rows.length > 0 &&
            rows.map((row) => {
              const id = getRowId(row);
              const isSelected = selectedSet.has(id);
              return (
                <TableRow key={id} data-state={isSelected ? "selected" : undefined}>
                  {selectable && (
                    <TableCell>
                      <Checkbox
                        aria-label={`Select row ${id}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleToggleRow(id, checked === true)}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={column.key}
                      className={cn(
                        "text-body-lg text-on-surface",
                        ALIGN_CLASS[column.align ?? "left"],
                      )}
                    >
                      {column.render(row)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}
        </TableBody>
      </Table>
    </div>
  );
}
