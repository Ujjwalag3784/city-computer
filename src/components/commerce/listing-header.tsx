import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface ListingHeaderStat {
  label: string;
  value: string;
}

export interface ListingHeaderProps {
  /** Usually `<Breadcrumbs />`. */
  breadcrumbs?: ReactNode;
  /** Mono kicker above the title, e.g. "Category". */
  eyebrow?: string;
  title: string;
  description?: string | null;
  /** Small stat chips on the right (product count, delivery). */
  stats?: ListingHeaderStat[];
  className?: string;
}

/**
 * The title block of every product-listing page (category, brand, search,
 * all products) — Stitch's "Laptops & Ultrabooks" header: mono breadcrumb,
 * an eyebrow, a large Manrope title and description, and stat chips on the
 * right.
 */
export function ListingHeader({
  breadcrumbs,
  eyebrow,
  title,
  description,
  stats = [],
  className,
}: ListingHeaderProps) {
  return (
    <header className={cn("flex flex-col gap-5", className)}>
      {breadcrumbs}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-3">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="text-display-sm text-on-surface">{title}</h1>
          {description && <p className="text-body-lg text-on-surface-variant">{description}</p>}
        </div>
        {stats.length > 0 && (
          <dl className="flex flex-wrap gap-3">
            {stats.map((stat) => (
              <div key={stat.label} className="panel flex flex-col gap-0.5 rounded-xl px-4 py-2.5">
                <dt className="font-mono text-label-mono-xs text-on-surface-variant">
                  {stat.label}
                </dt>
                <dd className="font-display text-[0.9375rem] font-bold text-on-surface">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </header>
  );
}

/** Shared outer wrapper for listing pages, matching the header's 1440px grid. */
export const LISTING_PAGE_CLASS =
  "mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 py-8 sm:px-6 lg:px-12 lg:py-10";
