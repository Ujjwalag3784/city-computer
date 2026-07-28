"use client";

import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/admin/step-indicator";
import { cn } from "@/lib/utils";

/**
 * GuidedForm — docs/09-ADMIN-DAD-MODE.md §5.1 "The four-step wizard":
 * consistent chrome for any multi-step admin wizard (Add Product, and any
 * future step-based flow) — a `StepIndicator` up top, the current step's
 * own fields in the middle, and a footer that always offers "Save as
 * draft" ("save-as-draft at every step") alongside Back/Next, or a
 * caller-supplied final action ("Publish"/"Save") in place of "Next" on
 * the last step.
 *
 * `children` is rendered as-is: this component deliberately doesn't know
 * or care what a given step contains — docs/09 §5.1 frames each of the
 * four steps (Basics, Photos, Details, Search) as simple and
 * self-contained, and owning that is entirely the caller's job.
 *
 * `"use client"`: every footer button's `onClick` (and `StepIndicator`'s
 * `onStepClick`) is wired directly in this file's render tree.
 */
export interface GuidedFormProps {
  steps: string[];
  currentIndex: number;
  onStepClick?: (index: number) => void;
  onBack?: () => void;
  onNext?: () => void;
  onSaveDraft: () => void;
  /** Rendered instead of "Next" on the final step. */
  finalStepAction?: { label: string; onClick: () => void };
  children: ReactNode;
  className?: string;
}

export function GuidedForm({
  steps,
  currentIndex,
  onStepClick,
  onBack,
  onNext,
  onSaveDraft,
  finalStepAction,
  children,
  className,
}: GuidedFormProps) {
  const isFirstStep = currentIndex === 0;
  const isLastStep = currentIndex === steps.length - 1;

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      <StepIndicator steps={steps} currentIndex={currentIndex} onStepClick={onStepClick} />

      <div>{children}</div>

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-glass-stroke pt-6">
        <Button type="button" variant="ghost" onClick={onSaveDraft}>
          Save as draft
        </Button>

        <div className="flex items-center gap-3">
          {!isFirstStep && (
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
          )}
          {isLastStep ? (
            finalStepAction && (
              <Button type="button" variant="primary" glow onClick={finalStepAction.onClick}>
                {finalStepAction.label}
              </Button>
            )
          ) : (
            <Button type="button" variant="primary" onClick={onNext}>
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
