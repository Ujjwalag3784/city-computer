import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ProductListFilter } from "@/lib/validation/admin/product";

/**
 * docs/09-ADMIN-DAD-MODE.md §5.2: "Filter chips: All · Live · Not
 * published · Out of stock · Almost out of stock · No photo · On offer."
 * Plain links, not client-side state — each chip is just `?filter=...`,
 * so the active chip survives a page refresh/bookmark and this component
 * needs no `"use client"` boundary at all.
 */
const FILTERS: { value: ProductListFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "draft", label: "Not published" },
  { value: "out-of-stock", label: "Out of stock" },
  { value: "low-stock", label: "Almost out of stock" },
  { value: "no-photo", label: "No photo" },
  { value: "on-offer", label: "On offer" },
];

export function FilterChips({ active, q }: { active: ProductListFilter; q?: string }) {
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Show only">
      {FILTERS.map((filter) => {
        const params = new URLSearchParams();
        if (filter.value !== "all") params.set("filter", filter.value);
        if (q) params.set("q", q);
        const href = params.toString() ? `/admin/products?${params.toString()}` : "/admin/products";
        const isActive = active === filter.value;
        return (
          <Link
            key={filter.value}
            href={href}
            aria-current={isActive ? "true" : undefined}
            className={cn(
              "rounded-full border px-3 py-1.5 text-body-sm transition-colors",
              isActive
                ? "border-primary-container bg-primary-container text-on-primary-container"
                : "border-glass-stroke text-on-surface-variant hover:border-primary-container hover:text-on-surface",
            )}
          >
            {filter.label}
          </Link>
        );
      })}
    </div>
  );
}
