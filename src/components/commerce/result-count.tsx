import { cn } from "@/lib/utils";

/**
 * ResultCount — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "ResultCount". Sits beside `SortSelect` in the header row above
 * `ProductGrid` per docs/05 §8's Category/Shop page layout ("Breadcrumb →
 * H1 + count + sort → ..."); this component only renders the count text
 * itself, the page owns that row's layout.
 *
 * No `"use client"` needed: a plain, prop-driven text node.
 *
 * `count.toLocaleString("en-US")` mirrors `formatNPR`'s own
 * `Intl.NumberFormat("en-US", ...)` Western-thousands-grouping convention
 * (`src/lib/money.ts`) rather than introducing a second number formatter —
 * there is no existing shared plain-integer formatter in `src/lib` to
 * reuse instead.
 */
export interface ResultCountProps {
  count: number;
  className?: string;
}

export function ResultCount({ count, className }: ResultCountProps) {
  return (
    <p className={cn("text-body-sm text-on-surface-variant", className)}>
      {count.toLocaleString("en-US")} result{count === 1 ? "" : "s"}
    </p>
  );
}
