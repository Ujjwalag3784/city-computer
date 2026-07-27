"use client";

import { ArrowUpDown } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * SortSelect — docs/05-DESIGN-SYSTEM.md §6 component inventory: "SortSelect".
 * The option list is the exact set from docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md
 * §2.1: "Sort: relevance, price ↑↓, newest, best-selling, discount %" — no
 * more, no fewer.
 *
 * Sits beside `ResultCount` in the header row above `ProductGrid` per
 * docs/05 §8's Category/Shop page layout ("Breadcrumb → H1 + count +
 * sort → ..."); this component only renders the control itself, the page
 * owns that row's layout.
 *
 * `"use client"`: built on the Radix-backed `Select` primitive exactly as
 * `emi-widget.tsx` already does, which needs the browser to manage its own
 * open/closed state.
 */
export type SortOption =
  | "relevance"
  | "price-asc"
  | "price-desc"
  | "newest"
  | "best-selling"
  | "discount";

export const SORT_OPTION_LABELS: Record<SortOption, string> = {
  relevance: "Relevance",
  "price-asc": "Price: low to high",
  "price-desc": "Price: high to low",
  newest: "Newest",
  "best-selling": "Best-selling",
  discount: "Biggest discount",
};

const SORT_OPTIONS = Object.keys(SORT_OPTION_LABELS) as SortOption[];

/** Runtime guard back into the closed `SortOption` union — see `handleValueChange` below. */
function isSortOption(value: string): value is SortOption {
  return Object.hasOwn(SORT_OPTION_LABELS, value);
}

export interface SortSelectProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  className?: string;
}

export function SortSelect({ value, onChange, className }: SortSelectProps) {
  // Radix's `onValueChange` always hands back a plain `string`, never the
  // narrower `SortOption` — rather than a blind cast, verify the incoming
  // string is actually a key of `SORT_OPTION_LABELS` before calling
  // `onChange`, falling back to "relevance" in the should-never-happen case
  // of a stray value (belt-and-suspenders, since every `SelectItem` value
  // below is generated 1:1 from `SORT_OPTIONS`).
  const handleValueChange = (next: string) => {
    onChange(isSortOption(next) ? next : "relevance");
  };

  return (
    <Select value={value} onValueChange={handleValueChange}>
      <SelectTrigger aria-label="Sort by" className={cn("w-auto min-w-[13rem] gap-2", className)}>
        <ArrowUpDown className="size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map((option) => (
          <SelectItem key={option} value={option}>
            {/* `option` is drawn from the closed `SortOption` union, not arbitrary input — safe to index. */}
            {/* eslint-disable-next-line security/detect-object-injection */}
            {SORT_OPTION_LABELS[option]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
