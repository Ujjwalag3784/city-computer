"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StepRail — docs/05-DESIGN-SYSTEM.md §8 Builder page layout:
 * "`lg:` [2-col step rail ‖ 7-col slot workspace ‖ 3-col sticky summary]".
 * This component is only the "2-col step rail" piece — composing the
 * surrounding 12-col grid is the future `/build` page's job, not this
 * component's, so it renders `hidden lg:flex lg:flex-col` and nothing wider.
 *
 * The step list itself is caller-supplied, not hardcoded: docs/08-PC-BUILDER
 * -ENGINE.md §9's Standard mode is a "10-step rail" (Purpose, Budget, Core,
 * Memory, Graphics, Storage, Power, Cooling, Case, Review per
 * docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md §4.2's journey diagram), but Guided
 * mode is a differently-shaped "6 questions" flow (§9) — this rail renders
 * whatever `steps` it's given rather than assuming the 10-step set is the
 * only possible shape.
 *
 * `isReachable` lets a caller mark a step whose required data is already
 * present as jumpable-to even out of linear order (a revisit) — this
 * component never enforces that gating itself, it only refuses to render a
 * clickable `<button>` for a step where `onStepClick` is provided but
 * `isReachable === false`, leaving all gating policy to the caller.
 *
 * Why this duplicates `StepperNav`'s vertical markup instead of composing it
 * (docs/05 §6 "StepperNav" is the obvious first choice, and
 * `order-status-tracker.tsx` shows the intended thin-wrapper pattern for
 * *non-interactive* consumers): `StepperNav` renders a plain `<ol>`/`<li>`
 * tree with no per-step click hook, and it deliberately isn't a Client
 * Component. Overlaying invisible absolutely-positioned click targets on
 * top of its output would be fragile (drift between the overlay's geometry
 * and the real node positions on any font-size/zoom change). Wrapping its
 * *entire* rendered `<ol>` in one big click handler can't work either,
 * because clicking any one step needs to identify *which* index was
 * clicked. So this component hand-rolls the same node/line/label visual
 * treatment `StepperNav` uses — same status -> node mapping (`complete` =
 * filled check circle, `current` = outlined circle with `aria-current=
 * "step"`, `upcoming` = muted circle; per docs/05 §5 A6 every status pairs
 * its colour with a distinct shape/icon, never colour alone) — but wraps
 * each node+label pair in a real `<button>` when `onStepClick` is supplied
 * and the step is reachable, falling back to a plain non-interactive `<li>`
 * otherwise.
 *
 * `"use client"` — `onClick` is attached directly to native `<button>`
 * elements rendered in this file's own tree, the same reasoning
 * `compare-table.tsx` and `cart-line-item.tsx` already established in this
 * codebase: a function prop attached to a host element can't cross the
 * Server -> Client boundary, so the component that owns the handler must
 * itself be a Client Component regardless of whether `onStepClick` is even
 * passed (the directive is a property of this file's render tree, not of
 * whether a given render happens to receive the optional prop).
 *
 * Every node meets docs/05 §5 A9's 44×44 minimum touch target via `size-11`
 * buttons, and the whole rail is reachable by keyboard (§5 A4) since each
 * clickable step is a real `<button>`.
 */
export interface BuilderStepInfo {
  label: string;
  status: "complete" | "current" | "upcoming";
  /** True once this step's required data is present — lets the rail allow jumping ahead to a step that's already been filled in, even out of order (revisits), while still disallowing jumping to a step that hasn't been reached yet if `onStepClick` cares to enforce that (this component doesn't enforce it itself — it just exposes the click). */
  isReachable?: boolean;
}

export interface StepRailProps {
  steps: BuilderStepInfo[];
  onStepClick?: (index: number) => void;
  className?: string;
}

function labelClasses(status: BuilderStepInfo["status"]): string {
  return cn(
    "text-body-sm",
    status === "complete" && "text-on-surface",
    status === "current" && "text-on-surface font-medium",
    status === "upcoming" && "text-on-surface-variant opacity-70",
  );
}

function StepNode({ status, ordinal }: { status: BuilderStepInfo["status"]; ordinal: number }) {
  if (status === "complete") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
        <Check className="size-4" aria-hidden="true" />
      </span>
    );
  }

  if (status === "current") {
    return (
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full border-2 border-primary-container text-on-surface text-label-mono-xs">
        {ordinal}
      </span>
    );
  }

  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-glass-stroke text-on-surface-variant text-label-mono-xs opacity-70">
      {ordinal}
    </span>
  );
}

export function StepRail({ steps, onStepClick, className }: StepRailProps) {
  return (
    <nav aria-label="Builder steps" className={cn("hidden lg:flex lg:flex-col", className)}>
      <ol className="flex list-none flex-col">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;
          const lineFilled = step.status === "complete";
          const isClickable = Boolean(onStepClick) && step.isReachable !== false;

          const node = (
            <div className="flex flex-col items-center">
              <StepNode status={step.status} ordinal={index + 1} />
              {!isLast && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-8 w-px",
                    lineFilled ? "bg-primary-container" : "bg-glass-stroke",
                  )}
                />
              )}
            </div>
          );

          const label = (
            <span className={cn(labelClasses(step.status), "ml-3 pt-1.5")}>{step.label}</span>
          );

          return (
            <li
              key={step.label}
              aria-current={step.status === "current" ? "step" : undefined}
              className="flex items-start"
            >
              {isClickable ? (
                <button
                  type="button"
                  onClick={() => onStepClick?.(index)}
                  className={cn(
                    "flex min-h-11 items-start rounded text-left",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                  )}
                >
                  {node}
                  {label}
                </button>
              ) : (
                <div className="flex min-h-11 items-start">
                  {node}
                  {label}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
