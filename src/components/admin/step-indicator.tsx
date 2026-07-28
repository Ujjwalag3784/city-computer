"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StepIndicator — docs/09-ADMIN-DAD-MODE.md §5.1 "The four-step wizard":
 * "Product creation is four steps with a progress indicator, save-as-draft
 * at every step, and no step that can't be skipped and returned to."
 *
 * Distinct from the customer-facing `StepperNav` (src/components/commerce/
 * stepper-nav.tsx) and the PC Builder's `StepRail` (src/components/builder/
 * step-rail.tsx): per docs/09 §11's admin-specific accessibility overrides,
 * touch targets here are 48×48 (not the general 44×44) and body text is
 * 16px minimum (not the general 14px `text-body-sm`), and the wizard steps
 * this indicates ("Basics", "Photos", "Details", "Search") are plain
 * labels, not the richer `{ label, status }` shape `StepperNav` takes. This
 * hand-rolls its own compact node+line treatment rather than composing
 * `StepperNav` — the same call `step-rail.tsx` already made for an
 * *interactive* stepper (one with per-step click handling), as opposed to
 * `order-status-tracker.tsx`'s thin non-interactive wrapper around
 * `StepperNav` directly.
 *
 * `"use client"`: `onStepClick`, when supplied, is attached to native
 * `<button>` elements rendered in this file's own tree — the same
 * Server/Client-boundary reasoning `step-rail.tsx` documents: a function
 * prop on a host element can't cross that boundary, so the file that owns
 * the handler must itself be a Client Component regardless of whether a
 * given render actually receives the optional prop.
 *
 * "No step that can't be... returned to" is read here as: only *earlier,
 * already-visited* steps (`index < currentIndex`) are ever clickable, even
 * when `onStepClick` is supplied — jumping ahead of data that hasn't been
 * filled in yet is a different, intentionally unsupported affordance.
 *
 * Per docs/05-DESIGN-SYSTEM.md §5 A6 ("status never communicated by colour
 * alone"), completed steps get a filled circle *and* a check icon, the
 * current step gets a ring *and* `aria-current="step"`, and upcoming steps
 * get a muted outline and their ordinal number.
 */
export interface StepIndicatorProps {
  steps: string[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
  className?: string;
}

type NodeStatus = "complete" | "current" | "upcoming";

function nodeStatus(index: number, currentIndex: number): NodeStatus {
  if (index < currentIndex) return "complete";
  if (index === currentIndex) return "current";
  return "upcoming";
}

function labelClasses(status: NodeStatus): string {
  return cn(
    "text-body-md",
    status === "complete" && "text-on-surface",
    status === "current" && "text-on-surface font-medium",
    status === "upcoming" && "text-on-surface-variant opacity-70",
  );
}

function StepNode({ status, ordinal }: { status: NodeStatus; ordinal: number }) {
  return (
    <span
      className={cn(
        "flex size-12 shrink-0 items-center justify-center rounded-full text-label-mono-xs",
        status === "complete" && "bg-primary-container text-on-primary-container",
        status === "current" && "border-2 border-primary-container text-on-surface",
        status === "upcoming" && "border border-glass-stroke text-on-surface-variant opacity-70",
      )}
    >
      {status === "complete" ? <Check className="size-5" aria-hidden="true" /> : ordinal}
    </span>
  );
}

export function StepIndicator({ steps, currentIndex, onStepClick, className }: StepIndicatorProps) {
  return (
    <ol aria-label="Progress" className={cn("flex w-full list-none items-start", className)}>
      {steps.map((label, index) => {
        const status = nodeStatus(index, currentIndex);
        const isLast = index === steps.length - 1;
        const isClickable = Boolean(onStepClick) && index < currentIndex;
        const lineFilled = status === "complete";

        const node = <StepNode status={status} ordinal={index + 1} />;
        const labelSpan = (
          <span className={cn(labelClasses(status), "whitespace-nowrap")}>{label}</span>
        );

        return (
          <li
            key={label}
            aria-current={status === "current" ? "step" : undefined}
            className={cn("flex items-start", isLast ? "flex-none" : "flex-1")}
          >
            <div className="flex flex-col items-center gap-2">
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(index)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  {node}
                  {labelSpan}
                </button>
              ) : (
                <>
                  {node}
                  {labelSpan}
                </>
              )}
            </div>
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-2 mt-6 h-px flex-1 self-start",
                  lineFilled ? "bg-primary-container" : "bg-glass-stroke",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
