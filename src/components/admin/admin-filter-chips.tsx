import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * The "Show only" chip row behind docs/09-ADMIN-DAD-MODE.md §5.2 ("Filter
 * chips: All · Live · Not published...") and §6's inventory screen (All ·
 * Almost out of stock · Out of stock). Plain links driving `?filter=...`,
 * not client state — a chip survives a page refresh/bookmark, and this
 * needs no `"use client"` boundary. Promoted here from `admin/products/
 * _components/filter-chips.tsx` on its second consumer (`admin/inventory/
 * page.tsx`), same "second consumer" rule as `admin-search-box.tsx`.
 */
export interface AdminFilterChipOption {
  value: string;
  label: string;
}

export interface AdminFilterChipsProps {
  options: AdminFilterChipOption[];
  active: string;
  /** e.g. `/admin/products` — the chip's own href is this plus `?filter=...`. */
  basePath: string;
  /** The value that means "no `filter` param at all" (usually `"all"`) — omitted from the URL so the unfiltered view is the plain, bookmarkable base path. */
  defaultValue?: string;
  /** Other query params to preserve across a chip click, e.g. the current search term. */
  q?: string;
}

export function AdminFilterChips({
  options,
  active,
  basePath,
  defaultValue = "all",
  q,
}: AdminFilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Show only">
      {options.map((option) => {
        const params = new URLSearchParams();
        if (option.value !== defaultValue) params.set("filter", option.value);
        if (q) params.set("q", q);
        const href = params.toString() ? `${basePath}?${params.toString()}` : basePath;
        const isActive = active === option.value;
        return (
          <Link
            key={option.value}
            href={href}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-body-sm transition-colors",
              isActive
                ? "border-primary-container bg-primary-container text-on-primary-container"
                : "border-glass-stroke text-on-surface-variant hover:border-primary-container hover:text-on-surface",
            )}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}
