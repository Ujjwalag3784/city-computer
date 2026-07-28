import { AdminSearchBox } from "@/components/admin/admin-search-box";

/**
 * docs/09-ADMIN-DAD-MODE.md §5.2's product-list search box.
 *
 * A thin, product-list-specific instantiation of the shared
 * `AdminSearchBox` (promoted to `components/admin/` on this component's
 * second consumer, `admin/inventory/page.tsx`) — kept as a same-named,
 * same-shaped wrapper so `admin/products/page.tsx` doesn't need to
 * change, rather than deleted outright (this sandbox's mounted
 * filesystem doesn't support deleting files).
 */
export function ProductSearchBox({ initialValue }: { initialValue: string }) {
  return (
    <AdminSearchBox initialValue={initialValue} placeholder="Search products or product codes..." />
  );
}
