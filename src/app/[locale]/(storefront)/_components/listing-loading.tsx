import { Skeleton } from "@/components/ui/skeleton";
import { ProductGrid } from "@/components/commerce/product-grid";

/**
 * Shared body for every `loading.tsx` under `(storefront)/` that renders a
 * product listing (`c/`, `b/`, `search/` — `p/[productSlug]` has its own,
 * PDP-shaped skeleton instead). docs/05-DESIGN-SYSTEM.md §7: "Skeleton
 * matching the final layout — never a spinner where content will appear."
 * `ProductGrid`'s own `loading` prop already builds the six placeholder
 * cards; this just adds the breadcrumb/heading-shaped bars above it.
 */
export function ListingLoading() {
  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-4 sm:p-8">
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-9 w-64" />
      <ProductGrid products={[]} loading />
    </div>
  );
}
