import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import type { CategoryTreeNode } from "@/server/services/catalog/category";

/**
 * Home-page-only category tile grid. Route-private (`_components/`, docs/04
 * §7's colocation policy) — nothing else in the storefront route tree needs
 * a grid of top-level categories, only the homepage's "Shop by category"
 * section. `/c/[...categorySlug]` itself renders a product listing, not
 * another tile grid.
 *
 * No dedicated `CategoryCard` component existed in the Phase 2 design
 * system to reuse here (checked: docs/05 §6's component inventory doesn't
 * list one either) — this is a small, self-contained tile built directly
 * on the `Card` primitive rather than inventing a new shared component for
 * a single consumer.
 */
export function CategoryGrid({ categories }: { categories: CategoryTreeNode[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {categories.map((category) => (
        <Link key={category.id} href={`/c/${category.path}`}>
          <Card className="flex h-28 flex-col items-center justify-center gap-2 p-4 text-center transition-colors hover:bg-surface-container-high">
            <span className="text-body-md font-medium text-on-surface">{category.name}</span>
          </Card>
        </Link>
      ))}
    </div>
  );
}
