import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { CategoryTreeNode } from "@/server/services/catalog/category";

const SUBCATEGORY_PREVIEW_COUNT = 4;

/**
 * Home-page-only department tiles — Stitch's "DEPOT 01 / Laptops &
 * Ultrabooks" modules. Each tile shows a numbered kicker, the category name,
 * and its real sub-categories as the description (so it never needs
 * hand-written marketing copy per category).
 */
export function CategoryGrid({ categories }: { categories: CategoryTreeNode[] }) {
  return (
    <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
      {categories.map((category, index) => {
        const children = category.children.slice(0, SUBCATEGORY_PREVIEW_COUNT).map((c) => c.name);
        return (
          <li key={category.id}>
            <Link
              href={`/c/${category.path}`}
              className="group panel flex h-full min-h-32 flex-col justify-between gap-4 p-4 sm:min-h-40 sm:gap-6 sm:p-5 transition-colors duration-150 hover:border-outline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-mono text-label-mono-xs text-primary">
                  Dept {String(index + 1).padStart(2, "0")}
                </span>
                <ArrowUpRight
                  className="size-4 text-on-surface-variant transition-colors group-hover:text-primary"
                  aria-hidden="true"
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="font-display text-[0.9375rem] font-bold leading-snug text-on-surface transition-colors group-hover:text-primary sm:text-headline-sm">
                  {category.name}
                </span>
                <span className="hidden sm:block">
                  <span className="line-clamp-2 text-body-sm text-on-surface-variant">
                    {children.length > 0 ? children.join(" · ") : "Browse the range"}
                  </span>
                </span>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
