import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { DataTableColumn } from "@/components/admin/data-table";

/**
 * DataTableStatic — the read-only, Server-Component-safe twin of
 * `data-table.tsx`.
 *
 * WHY THIS FILE EXISTS. `DataTable` is a Client Component: its sort headers
 * and selection checkboxes wire `onClick`/`onCheckedChange` onto elements in
 * its own tree, and it holds `React.useMemo` state. But its API is built
 * around functions — `columns[].render(row)` and `getRowId(row)` — and ten
 * admin list pages (`/admin/{blog,branches,campaigns,coupons,customers,
 * orders,pages,products,service,users}`) are plain **Server** Components
 * that were passing those functions straight across the server→client
 * boundary. React cannot serialise a function into the RSC payload, so every
 * one of those ten routes threw
 *
 *     Error: Event handlers cannot be passed to Client Component props.
 *
 * and returned HTTP 500 — the same bug class that took down the storefront
 * homepage (see `commerce/product-card.tsx`'s header).
 *
 * Those ten pages use none of `DataTable`'s interactive features: no
 * `sortable` columns, no `selectable`, no `onSortChange`, no
 * `onSelectionChange`, no `loading`. They sort and paginate through the URL
 * query string and let the page re-render on the server. So the correct fix
 * is not to drag each page into the client, nor to invent a serialisable
 * column protocol — it is to render exactly the same table markup *on the
 * server*, where handing a `render` function to a child is completely legal
 * because no boundary is crossed. These pages now also ship zero client JS
 * for their table, which is strictly better.
 *
 * `DataTableColumn<T>` is imported from `data-table.tsx` rather than
 * redeclared, so the two components cannot drift apart on column shape. Only
 * `sortable` is ignored here (there is nothing to click without a client
 * handler); pages that need interactive sorting/selection keep using
 * `DataTable` from inside a Client Component, as
 * `inventory-table.tsx`/`brand-table.tsx`/`buildable-parts-table.tsx` do.
 *
 * The visual output is deliberately identical to `DataTable`'s
 * non-interactive branches — same wrapper, same `ALIGN_CLASS`, same
 * `text-body-lg` cell type scale (docs/09 §11: 18px table content), same
 * empty-state row — so swapping a page over changes nothing on screen.
 */
/**
 * Re-exported so a server page needs a single import for both the component
 * and its column type, and never has to name the `"use client"` module at
 * all.
 */
export type { DataTableColumn };

export interface DataTableStaticProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string;
  emptyMessage?: string;
  className?: string;
}

const ALIGN_CLASS: Record<"left" | "right" | "center", string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

export function DataTableStatic<T>({
  columns,
  rows,
  getRowId,
  emptyMessage = "No results.",
  className,
}: DataTableStaticProps<T>) {
  return (
    <div className={cn("w-full overflow-x-auto rounded-xl border border-glass-stroke", className)}>
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={ALIGN_CLASS[column.align ?? "left"]}>
                {column.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={columns.length}
                className="py-12 text-center text-body-lg text-on-surface-variant"
              >
                {emptyMessage}
              </TableCell>
            </TableRow>
          )}

          {rows.map((row) => (
            <TableRow key={getRowId(row)}>
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
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
