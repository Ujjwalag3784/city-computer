import { cn } from "@/lib/utils";

export interface SpecRow {
  label: string;
  value: string;
}

export interface SpecGroup {
  title: string;
  rows: SpecRow[];
}

export interface SpecTableProps {
  groups: SpecGroup[];
  className?: string;
}

/**
 * SpecTable — docs/05-DESIGN-SYSTEM.md §2 ("structured, category-templated
 * specifications") + §11 (alternating row tints on spec tables).
 *
 * Deliberately does not reuse `components/ui/table.tsx`'s
 * `Table`/`TableRow`/`TableCell` primitives. That file wraps a real
 * `<table>`/`<thead>`/`<tbody>` — built for tabular grids with shared
 * columns across many rows (see its own header comment). A product spec
 * sheet is a flat run of independent label/value pairs grouped under
 * headings, with no columns to align across groups — exactly the shape
 * `<dl>` describes semantically. A hand-rolled `<dl>` with `<div>` row
 * wrappers (valid HTML5 — `<dl>` permits `<div>` children grouping
 * `<dt>`/`<dd>` pairs) gets the same `odd:bg-surface-container-high` zebra
 * striping `Table`'s own comment calls out as a per-table opt-in, without
 * fighting the `<table>` layout model for a shape it wasn't designed for.
 *
 * Responsive: each row stacks label above value on narrow screens
 * (`grid-cols-1`) and moves to a two-column layout at `sm:` — long spec
 * labels never truncate or force horizontal scroll.
 */
export function SpecTable({ groups, className }: SpecTableProps) {
  return (
    <div className={cn("flex flex-col gap-6", className)}>
      {groups.map((group) => (
        <section key={group.title} className="flex flex-col gap-2">
          <h3 className="text-title text-on-surface">{group.title}</h3>
          <dl className="overflow-hidden rounded-xl border border-glass-stroke">
            {group.rows.map((row) => (
              <div
                key={row.label}
                className={cn(
                  "grid grid-cols-1 gap-1 px-4 py-3 odd:bg-surface-container-high",
                  "sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:gap-4",
                )}
              >
                <dt className="text-body-sm text-on-surface-variant">{row.label}</dt>
                <dd className="text-body-sm text-on-surface">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
