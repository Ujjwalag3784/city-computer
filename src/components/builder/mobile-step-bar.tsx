"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BuilderStepInfo } from "@/components/builder/step-rail";
import { cn } from "@/lib/utils";

/**
 * MobileStepBar — docs/05-DESIGN-SYSTEM.md §8 Builder page layout: "`<lg:`
 * [horizontal step bar -> slot stack -> sticky bottom summary bar...]".
 *
 * This is NOT a responsive variant of `StepRail` reused at a smaller
 * breakpoint — a full 10-item vertical rail laid out horizontally would be
 * far too tall/wide on a phone screen, so this is a genuinely denser UI:
 * a thin progress bar plus a single "Step N of M · Label" line with
 * previous/next controls, rather than every step's node rendered at once.
 * It imports `BuilderStepInfo` from `step-rail.tsx` rather than
 * redeclaring an equivalent shape, so both components always agree on what
 * a "step" looks like.
 *
 * `<lg`-only rendering contract: `flex lg:hidden`, the mirror image of
 * `StepRail`'s own `hidden lg:flex`, so exactly one of the two renders at
 * any given breakpoint.
 *
 * `"use client"` — `onPrevious`/`onNext` are wired directly to native
 * `<button>` `onClick` handlers in this file's own render tree, the same
 * convention `step-rail.tsx`/`compare-table.tsx`/`cart-line-item.tsx`
 * already establish: a function prop attached to a host element can't
 * cross the Server -> Client boundary, so the component that owns the
 * handler must itself be a Client Component.
 *
 * Reading `steps[currentIndex]` safely under this codebase's
 * `noUncheckedIndexedAccess`: following the exact idiom
 * `src/components/commerce/gallery.tsx` uses for `firstImage`/`active`,
 * `steps[0]` is captured up front (before any guard) so its narrowed
 * non-undefined type is available as a fallback; once guarded against an
 * empty `steps` array, `steps[currentIndex] ?? firstStep` is guaranteed
 * non-undefined without ever asserting away the index-access check.
 *
 * Every control meets docs/05 §5 A9's 44x44 minimum touch target via
 * `size-11` buttons, and the previous/next controls disable at the ends
 * rather than wrapping (unlike `Gallery`'s chevrons) since "step 0 of 10"
 * has no meaningful step before it to wrap to.
 */
export interface MobileStepBarProps {
  steps: BuilderStepInfo[];
  currentIndex: number;
  onPrevious?: () => void;
  onNext?: () => void;
  className?: string;
}

export function MobileStepBar({
  steps,
  currentIndex,
  onPrevious,
  onNext,
  className,
}: MobileStepBarProps) {
  // Captured before any guard so its type narrows to non-undefined for the
  // rest of the function — mirrors gallery.tsx's `firstImage` pattern.
  const firstStep = steps[0];

  if (steps.length === 0 || !firstStep) {
    return null;
  }

  // `currentIndex` is caller-supplied and could theoretically be out of
  // range; the `?? firstStep` fallback already makes this access safe at
  // runtime regardless.
  // eslint-disable-next-line security/detect-object-injection
  const currentStep = steps[currentIndex] ?? firstStep;
  const progressPercent = ((currentIndex + 1) / steps.length) * 100;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;

  return (
    <div className={cn("flex lg:hidden flex-col gap-3", className)}>
      <div
        role="progressbar"
        aria-valuenow={currentIndex + 1}
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-label="Builder progress"
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high"
      >
        <div
          className="h-full rounded-full bg-primary-container transition-all"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label="Previous step"
          onClick={onPrevious}
          disabled={isFirst}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors",
            "hover:bg-surface-container-high hover:text-on-surface disabled:pointer-events-none disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>

        <span className="flex-1 text-center text-body-sm text-on-surface">
          Step {currentIndex + 1} of {steps.length} · {currentStep.label}
        </span>

        <button
          type="button"
          aria-label="Next step"
          onClick={onNext}
          disabled={isLast}
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors",
            "hover:bg-surface-container-high hover:text-on-surface disabled:pointer-events-none disabled:opacity-50",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          )}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
