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
/**
 * 2026-10-04 redesign (Stitch PDP "Full specifications"): one hairline card
 * per spec group, laid out in up to three columns, each row a mono label on
 * the left and the value on the right.
 */
export function SpecTable({ groups, className }: SpecTableProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 xl:grid-cols-3", className)}>
      {groups.map((group) => (
        <section key={group.title} className="panel flex flex-col overflow-hidden">
          <h3 className="flex items-center gap-2 border-b border-outline-variant px-5 py-3.5 font-mono text-label-mono-xs text-on-surface">
            <span aria-hidden="true" className="size-1.5 rounded-full bg-primary" />
            {group.title}
          </h3>
          <dl className="flex flex-col divide-y divide-outline-variant px-5">
            {group.rows.map((row) => (
              <div key={row.label} className="flex items-baseline justify-between gap-6 py-3">
                <dt className="shrink-0 font-mono text-label-mono-xs text-on-surface-variant">
                  {row.label}
                </dt>
                <dd className="text-right text-body-md text-on-surface">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
