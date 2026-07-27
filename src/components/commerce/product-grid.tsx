import type { ReactNode } from "react";
import { PackageX } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/components/commerce/product-card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * ProductGrid — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "ProductGrid". §8 Category/Shop page layout: "lg: [288px sticky filter
 * rail ‖ 3-col grid] / <lg: [filter button → sheet, 2-col grid]" — this
 * renders only the grid half of that contract (`grid-cols-2 lg:grid-cols-3`
 * for `variant="grid"`); laying it out beside `FilterRail`/
 * `MobileFilterSheet` is the page's job, this component doesn't know the
 * rail exists. `variant="list"` stacks single-column for dense
 * search-results-style pages. There is no `"compact"` variant here — that
 * one is `ProductCard`-only, for standalone carousels, not this grid.
 *
 * No `"use client"` needed: purely presentational, no local state.
 *
 * Implements both states docs/05 §7 "States every component must define"
 * requires here:
 * - **Loading**: "Skeleton matching the final layout — never a spinner
 *   where content will appear." Six `Skeleton`-built placeholders sized to
 *   `ProductCard`'s real grid-variant dimensions (aspect-square image, a
 *   label-width line, a title-width line, a price-width line, a
 *   button-height bar) stand in for `products` while `loading` is true —
 *   the real data is never rendered underneath a spinner.
 * - **Empty**: "Illustration + plain-language explanation + a primary
 *   action ('No products match these filters. Clear filters')." The
 *   "illustration" is a `PackageX` icon (no illustration-asset pipeline
 *   exists yet); the copy is the exact string from docs/05 §7's own
 *   example. `emptyAction` is left to the caller so it can drop in
 *   whatever "Clear filters" control already exists on the page (e.g. the
 *   same handler wired to `FilterRail`'s `onClearAll`) instead of this
 *   component inventing its own filter-clearing logic.
 */
export interface ProductGridProps {
  products: ProductCardData[];
  variant?: "grid" | "list";
  loading?: boolean;
  onAddToCart?: (product: ProductCardData) => void | Promise<void>;
  /** Rendered below the empty-state message when the grid has no results, e.g. a "Clear filters" button. */
  emptyAction?: ReactNode;
  className?: string;
}

const SKELETON_COUNT = 6;

/** One placeholder matching `ProductCard`'s real `variant="grid"` dimensions. */
function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-glass-stroke bg-surface-container p-3">
      <Skeleton className="aspect-square w-full rounded-lg" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-11 w-full" />
    </div>
  );
}

export function ProductGrid({
  products,
  variant = "grid",
  loading = false,
  onAddToCart,
  emptyAction,
  className,
}: ProductGridProps) {
  const layoutClassName = cn(
    variant === "grid" ? "grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-3" : "flex flex-col gap-4",
    className,
  );

  if (loading) {
    return (
      <div className={layoutClassName} aria-busy="true" aria-live="polite">
        {Array.from({ length: SKELETON_COUNT }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-xl border border-glass-stroke bg-surface-container px-6 py-16 text-center",
          className,
        )}
      >
        <PackageX className="size-10 text-on-surface-variant" aria-hidden="true" />
        <p className="text-body-md text-on-surface">No products match these filters.</p>
        {emptyAction}
      </div>
    );
  }

  return (
    <div className={layoutClassName}>
      {products.map((product) => (
        <ProductCard
          key={product.slug}
          product={product}
          variant={variant}
          onAddToCart={() => onAddToCart?.(product)}
        />
      ))}
    </div>
  );
}
