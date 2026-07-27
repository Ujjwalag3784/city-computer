import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Breadcrumbs — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "`Breadcrumbs`". docs/11-SEO-STRATEGY.md notes breadcrumb data will later
 * feed a `BreadcrumbList` JSON-LD schema, so the `items` prop is a plain,
 * serializable `{ label, href }[]` — no React nodes in the data, so the same
 * array can be handed to a schema generator without transformation.
 *
 * Server Component: purely presentational, no interactivity, so this is a
 * plain `next/link`-based render with no `"use client"` boundary.
 *
 * The last item in `items` is always treated as the current page: rendered
 * as plain text with `aria-current="page"`, never as a link, even if it
 * carries an `href` — you are already on that page, so linking to it again
 * is redundant and confusing for assistive tech.
 *
 * `showHomeIcon` defaults to `true` and prepends an automatic "Home" crumb
 * (icon-only, linking to `/`) before the passed `items` — most call sites
 * want this, so opt-out (rather than opt-in) keeps callers terse; pass
 * `showHomeIcon={false}` for the rare trail that shouldn't start at home.
 *
 * Accessibility: wrapped in `<nav aria-label="Breadcrumb">` (docs/05 §5),
 * separators are `aria-hidden` decoration only, and the Home icon carries an
 * explicit `aria-label` since it has no visible text (§5 A2).
 *
 * Small screens: rather than a collapsing-breadcrumb algorithm, the `<ol>`
 * scrolls horizontally (`overflow-x-auto`) so a long trail never wraps
 * awkwardly — an acceptable v1 per the design doc.
 */
export interface BreadcrumbItem {
  label: string;
  href?: string;
}

export interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  className?: string;
  /** Prepend an automatic icon-only "Home" crumb linking to `/`. Defaults to `true`. */
  showHomeIcon?: boolean;
}

const linkClasses = cn(
  "rounded text-body-sm text-on-surface-variant underline-offset-4 transition-colors hover:text-on-surface hover:underline",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

export function Breadcrumbs({ items, className, showHomeIcon = true }: BreadcrumbsProps) {
  const lastIndex = items.length - 1;

  return (
    <nav aria-label="Breadcrumb" className={className}>
      <ol className="flex flex-nowrap items-center gap-1.5 overflow-x-auto whitespace-nowrap">
        {showHomeIcon && (
          <>
            <li className="flex items-center">
              <Link href="/" aria-label="Home" className={linkClasses}>
                <Home className="size-3.5" />
              </Link>
            </li>
            {items.length > 0 && (
              <li aria-hidden="true" className="flex items-center">
                <ChevronRight className="size-3.5 text-on-surface-variant" />
              </li>
            )}
          </>
        )}

        {items.map((item, index) => {
          const isLast = index === lastIndex;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1.5">
              {isLast ? (
                <span aria-current="page" className="text-body-sm font-medium text-on-surface">
                  {item.label}
                </span>
              ) : (
                <Link href={item.href ?? "#"} className={linkClasses}>
                  {item.label}
                </Link>
              )}

              {!isLast && (
                <ChevronRight aria-hidden="true" className="size-3.5 text-on-surface-variant" />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
