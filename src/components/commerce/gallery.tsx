"use client";

import * as React from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { ThumbStrip } from "@/components/commerce/thumb-strip";
import { cn } from "@/lib/utils";

export interface GalleryProps {
  images: { src: string; alt: string }[];
  className?: string;
}

/**
 * Gallery — docs/05-DESIGN-SYSTEM.md §8 PDP layout ("`lg:grid-cols-12` →
 * 7-col gallery ‖ 5-col sticky buy column"). Composing the 12-col grid is
 * the PDP page's job; this component is self-contained and just needs to
 * size responsively inside whatever column it's dropped into.
 *
 * Main image carries the `scale-105`/700ms hover zoom from §4's "Image
 * hover" motion spec, clipped by `overflow-hidden` on the aspect-ratio-
 * locked parent so the zoom never spills past the rounded corners. The
 * fixed `aspect-square` box reserves layout space before the image loads —
 * no CLS, per the reserved-aspect-ratio-box performance budget referenced
 * in docs/11-SEO-STRATEGY.md.
 *
 * Chevron nav wraps around (last → first, first → last) instead of
 * disabling at the ends — a simpler interaction with no accessibility
 * requirement pushing toward a disabled-at-the-ends affordance instead.
 * `ThumbStrip` is wired to the same `activeIndex` state so keyboard/click
 * selection in either control keeps both in sync (§5 A4).
 */
export function Gallery({ images, className }: GalleryProps) {
  const [activeIndex, setActiveIndex] = React.useState(0);

  const goTo = React.useCallback(
    (index: number) => {
      if (images.length === 0) return;
      setActiveIndex((index + images.length) % images.length);
    },
    [images.length],
  );

  // Captured before the emptiness check so its type narrows to non-undefined
  // for the rest of the function — avoids an unsound array-index assumption
  // under `noUncheckedIndexedAccess` while still guaranteeing a fallback.
  const firstImage = images[0];

  if (images.length === 0 || !firstImage) {
    return (
      <div
        className={cn(
          "flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-xl border border-glass-stroke bg-surface-container",
          className,
        )}
      >
        <ImageOff className="size-10 text-on-surface-variant" aria-hidden="true" />
        <span className="text-body-sm text-on-surface-variant">No images available</span>
      </div>
    );
  }

  const active = images[Math.min(activeIndex, images.length - 1)] ?? firstImage;
  const hasMultiple = images.length > 1;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative aspect-square w-full overflow-hidden rounded-xl border border-glass-stroke bg-surface-container">
        <Image
          key={active.src}
          src={active.src}
          alt={active.alt}
          fill
          sizes="(min-width: 1024px) 58vw, 100vw"
          priority={activeIndex === 0}
          className="object-contain transition-transform duration-700 hover:scale-105"
        />
        {hasMultiple && (
          <>
            <button
              type="button"
              aria-label="Previous image"
              onClick={() => goTo(activeIndex - 1)}
              className={cn(
                "absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full",
                "bg-surface-container-high/80 text-on-surface backdrop-blur transition-colors hover:bg-surface-container-high",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label="Next image"
              onClick={() => goTo(activeIndex + 1)}
              className={cn(
                "absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full",
                "bg-surface-container-high/80 text-on-surface backdrop-blur transition-colors hover:bg-surface-container-high",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              )}
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
      {hasMultiple && (
        <ThumbStrip
          images={images}
          activeIndex={activeIndex}
          onSelect={goTo}
          orientation="horizontal"
        />
      )}
    </div>
  );
}
