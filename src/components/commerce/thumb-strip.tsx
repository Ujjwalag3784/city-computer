"use client";

import * as React from "react";
import { ProductImage } from "@/components/commerce/product-image";
import { cn } from "@/lib/utils";

export interface ThumbStripProps {
  images: { src: string; alt: string }[];
  activeIndex: number;
  onSelect: (index: number) => void;
  orientation?: "horizontal" | "vertical";
  className?: string;
}

/**
 * ThumbStrip — docs/05-DESIGN-SYSTEM.md §5 A4 ("full keyboard operability
 * ... gallery thumbnails" is explicitly called out as a defect in the
 * original Stitch exports) and §5 A9 (44×44 minimum touch target).
 *
 * Uses a `role="listbox"` / `role="option"` pattern rather than
 * `role="tablist"` — a listbox is the simpler, more correct ARIA fit for
 * "pick one thumbnail to preview" than tabs (tabs imply separate panels of
 * content, not a single shared main-image viewport). Selection state is
 * always doubled up as `aria-selected` + `aria-current` + a visible
 * `ring-2` treatment per §5 A6 ("status never communicated by colour
 * alone").
 *
 * Keyboard nav follows the ARIA APG listbox pattern: arrow keys move focus
 * *and* fire `onSelect` (so the main image updates as keyboard users
 * navigate) via a roving `tabIndex` — only the active option is
 * Tab-reachable, matching how every native listbox behaves. Wraps at both
 * ends (last → first, first → last) rather than stopping, matching the
 * wrap-around nav used in `Gallery`'s chevrons.
 */
export function ThumbStrip({
  images,
  activeIndex,
  onSelect,
  orientation = "horizontal",
  className,
}: ThumbStripProps) {
  const itemRefs = React.useRef<(HTMLButtonElement | null)[]>([]);

  const focusAndSelect = React.useCallback(
    (index: number) => {
      if (images.length === 0) return;
      const nextIndex = (index + images.length) % images.length;
      onSelect(nextIndex);
      // `nextIndex` is always `0 <= nextIndex < images.length` (wrapped via
      // modulo above), never unbounded/arbitrary input.
      // eslint-disable-next-line security/detect-object-injection
      itemRefs.current[nextIndex]?.focus();
    },
    [images.length, onSelect],
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const isHorizontal = orientation === "horizontal";
    const nextKey = isHorizontal ? "ArrowRight" : "ArrowDown";
    const prevKey = isHorizontal ? "ArrowLeft" : "ArrowUp";

    if (event.key === nextKey) {
      event.preventDefault();
      focusAndSelect(activeIndex + 1);
    } else if (event.key === prevKey) {
      event.preventDefault();
      focusAndSelect(activeIndex - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusAndSelect(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusAndSelect(images.length - 1);
    }
  };

  if (images.length === 0) {
    return null;
  }

  return (
    // The container uses a roving `tabIndex` — only the active `role="option"`
    // button below is Tab-reachable (native listbox behaviour), so the
    // container itself does not need its own `tabIndex`. jsx-a11y's
    // `interactive-supports-focus` rule doesn't account for the roving-
    // tabindex pattern here, same reasoning as `rating-stars.tsx`'s
    // `role="radiogroup"`.
    // eslint-disable-next-line jsx-a11y/interactive-supports-focus
    <div
      role="listbox"
      aria-label="Product images"
      aria-orientation={orientation}
      onKeyDown={handleKeyDown}
      className={cn(
        orientation === "horizontal"
          ? "flex flex-row gap-2 overflow-x-auto"
          : "flex flex-col gap-2",
        className,
      )}
    >
      {images.map((image, index) => {
        const isActive = index === activeIndex;
        return (
          <button
            key={`${image.src}-${index}`}
            ref={(node) => {
              // `index` comes from mapping over `images` itself, never
              // arbitrary/unbounded input.
              // eslint-disable-next-line security/detect-object-injection
              itemRefs.current[index] = node;
            }}
            type="button"
            role="option"
            aria-selected={isActive}
            aria-current={isActive ? "true" : undefined}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(index)}
            className={cn(
              "relative flex size-11 shrink-0 items-center justify-center rounded-lg border border-transparent p-1 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              isActive
                ? "border-primary-container ring-2 ring-primary-container"
                : "hover:border-glass-stroke",
            )}
          >
            <span className="relative aspect-square size-full overflow-hidden rounded">
              <ProductImage src={image.src} alt={image.alt} sizes="44px" className="object-cover" />
            </span>
          </button>
        );
      })}
    </div>
  );
}
