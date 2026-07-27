"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * RatingStars — docs/05-DESIGN-SYSTEM.md §6 component inventory groups this
 * with `ReviewList`/`ReviewForm` as **bold** (not in the original Stitch
 * designs); this is a from-scratch design rather than a fix of an existing
 * export.
 *
 * Read-only mode (the common case, e.g. on `ProductCard`/PDP) renders five
 * decorative, `aria-hidden` stars and exposes a single `aria-label` on the
 * wrapper so screen readers get one clean announcement instead of five
 * confusing icons.
 *
 * Interactive mode (used by `ReviewForm`) renders real `<button>` elements
 * in a `role="radiogroup"` per the WAI-ARIA radio-group pattern, each at
 * least `size-11` (44×44 CSS px) — docs/05 §5 A9 minimum touch target —
 * even though the visible star glyph inside is smaller.
 */
export interface RatingStarsProps {
  /** 0–5, can be fractional (e.g. 4.3) in read-only mode. */
  rating: number;
  /** Review count, shown as `(count)` in read-only mode when provided. */
  count?: number;
  size?: "sm" | "md";
  /** Defaults to true — a static display of an existing average rating. */
  readOnly?: boolean;
  /** Called with the selected 1–5 value when `readOnly` is false. */
  onRatingChange?: (rating: number) => void;
  className?: string;
}

const starSizeClass: Record<NonNullable<RatingStarsProps["size"]>, string> = {
  sm: "size-3.5",
  md: "size-5",
};

const STAR_VALUES = [1, 2, 3, 4, 5];

export function RatingStars({
  rating,
  count,
  size = "md",
  readOnly = true,
  onRatingChange,
  className,
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = React.useState<number | null>(null);
  // `size` is a closed "sm" | "md" union, not arbitrary input — safe to index.
  // eslint-disable-next-line security/detect-object-injection
  const starClass = starSizeClass[size];

  if (readOnly) {
    const label = `Rated ${rating} out of 5${count ? ` from ${count} reviews` : ""}`;
    return (
      <div className={cn("inline-flex items-center gap-1", className)} aria-label={label}>
        {STAR_VALUES.map((n) => {
          const fill = Math.max(0, Math.min(1, rating - (n - 1)));
          return (
            <span key={n} className={cn("relative inline-block", starClass)} aria-hidden="true">
              <Star className={cn(starClass, "absolute inset-0 text-on-surface-variant")} />
              <span
                className="absolute inset-0 overflow-hidden"
                style={{ width: `${fill * 100}%` }}
              >
                <Star className={cn(starClass, "fill-primary text-primary")} />
              </span>
            </span>
          );
        })}
        {typeof count === "number" && (
          <span className="text-body-sm text-on-surface-variant">({count})</span>
        )}
      </div>
    );
  }

  const activeRating = hoverRating ?? rating;

  return (
    // The container itself is not a keyboard-operable control — each star
    // `<button role="radio">` below is independently focusable and carries
    // the actual interaction. jsx-a11y's `interactive-supports-focus` rule
    // still flags any `role="radiogroup"` element without a `tabIndex`, which
    // doesn't apply to a group *container* under the WAI-ARIA radio group
    // pattern (only the items need to be focusable).
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      role="radiogroup"
      aria-label="Rate this product"
      className={cn("inline-flex items-center gap-1", className)}
      onMouseLeave={() => setHoverRating(null)}
    >
      {STAR_VALUES.map((n) => {
        const filled = n <= activeRating;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === rating}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className={cn(
              "inline-flex size-11 items-center justify-center rounded",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            )}
            onMouseEnter={() => setHoverRating(n)}
            onClick={() => onRatingChange?.(n)}
          >
            <Star
              className={cn(
                starClass,
                filled ? "fill-primary text-primary" : "text-on-surface-variant",
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
