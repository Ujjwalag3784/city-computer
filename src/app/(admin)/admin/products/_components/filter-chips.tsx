import { AdminFilterChips } from "@/components/admin/admin-filter-chips";
import type { ProductListFilter } from "@/lib/validation/admin/product";

/**
 * docs/09-ADMIN-DAD-MODE.md §5.2: "Filter chips: All · Live · Not
 * published · Out of stock · Almost out of stock · No photo · On offer."
 *
 * A thin, product-list-specific instantiation of the shared
 * `AdminFilterChips` (promoted to `components/admin/` on this
 * component's second consumer, `admin/inventory/page.tsx`) — kept as a
 * same-named, same-shaped wrapper so `admin/products/page.tsx` doesn't
 * need to change, rather than deleted outright (this sandbox's mounted
 * filesystem doesn't support deleting files).
 */
const PRODUCT_FILTERS = [
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
    <AdminFilterChips options={PRODUCT_FILTERS} active={active} basePath="/admin/products" q={q} />
  );
}
