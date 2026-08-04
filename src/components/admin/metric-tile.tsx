import type { ComponentType } from "react";
import Link from "next/link";
import { ArrowRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * MetricTile — docs/09-ADMIN-DAD-MODE.md §4 "The dashboard — 'Today'", Row 1:
 * four large tiles with a big number and a short helper line ("Orders
 * today" / 12 / "3 still need attention", "Money today" / रु 4,85,200 /
 * "Yesterday: रु 3,10,000", "Needs your attention" / 5 / "2 payments to
 * check · 3 orders to send", "Almost out of stock" / 7 / "See the list").
 * "Every number is clickable and lands on the filtered list that produced
 * it" — that's the optional `href`, which turns the whole tile into a
 * `next/link` with a hover `ArrowRight` hint and `hover:border-primary-
 * container`, matching the card-hover treatment already established by
 * `src/components/commerce/product-card.tsx`.
 *
 * The big `value` uses `text-price-lg` (docs/05-DESIGN-SYSTEM.md §2's
 * largest tabular-numeric display utility) rather than a one-off literal
 * size — docs/09 §11's 16/18px minimums are about form labels and table
 * content, not this display number, which should read as large as
 * possible from across a shop counter.
 *
 * Per docs/05 §5 A6 ("status/trend never communicated by colour alone")
 * `trend` always renders as a directional icon (`TrendingUp`/`TrendingDown`)
 * paired with its own descriptive `trend.label` text. Deliberately no
 * success/danger colour coding here: "up" is good news for a revenue tile
 * but bad news for a "needs attention" tile, so this generic component
 * can't safely infer sentiment from direction alone — callers that want
 * colour can add it themselves via `className` on a per-tile basis.
 *
 * No `"use client"`: this is plain presentational composition around a
 * `next/link` when `href` is given, same rationale as `ProductCard` — a
 * plain navigational link needs no client boundary.
 */
export interface MetricTileProps {
  label: string;
  value: string;
  helperLine?: string;
  href?: string;
  trend?: { direction: "up" | "down"; label: string };
  icon?: ComponentType<{ className?: string }>;
  className?: string;
}

export function MetricTile({
  label,
  value,
  helperLine,
  href,
  trend,
  icon: Icon,
  className,
}: MetricTileProps) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <span className="text-label-mono-xs text-on-surface-variant">{label}</span>
        {Icon && <Icon className="size-5 shrink-0 text-on-surface-variant" aria-hidden="true" />}
      </div>

      <span className="text-price-lg text-on-surface">{value}</span>

      {(helperLine ?? trend) && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {helperLine && <span className="text-body-sm text-on-surface-variant">{helperLine}</span>}
          {trend && (
            <span className="inline-flex items-center gap-1 text-body-sm text-on-surface-variant">
              {trend.direction === "up" ? (
                <TrendingUp className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <TrendingDown className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              {trend.label}
            </span>
          )}
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Card
        className={cn(
          "group relative p-[--space-card-padding] transition-all duration-300 hover:border-primary-container/60 hover:shadow-glow",
          className,
        )}
      >
        <Link
          href={href}
          className="flex flex-col gap-3 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container"
        >
          {body}
        </Link>
        <ArrowRight
          className="pointer-events-none absolute right-4 top-4 size-4 text-on-surface-variant opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </Card>
    );
  }

  return (
    <Card className={cn("flex flex-col gap-3 p-[--space-card-padding]", className)}>{body}</Card>
  );
}
