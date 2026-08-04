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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {categories.map((category) => (
        <Link key={category.id} href={`/c/${category.path}`} className="group">
          <Card className="relative flex h-36 flex-col justify-end overflow-hidden border border-glass-stroke bg-obsidian-surface p-6 transition-all duration-300 hover:border-primary-container/60 hover:shadow-glow">
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/40 to-transparent z-10" />
            <div className="relative z-20 flex flex-col gap-1">
              <span className="text-body-lg font-display font-semibold text-on-surface transition-colors group-hover:text-primary">
                {category.name}
              </span>
              <span className="text-label-mono-xs text-on-surface-variant group-hover:text-silver-text transition-colors">
                Explore Category &rarr;
              </span>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}
