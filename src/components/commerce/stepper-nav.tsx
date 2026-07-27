import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * StepperNav — docs/05-DESIGN-SYSTEM.md §6 component inventory: "StepperNav"
 * (steps + connecting line, horizontal or vertical). Purely presentational
 * — the controlling page owns which step is `"current"` and passes the
 * whole `steps` array down; no internal state, no `"use client"` needed.
 *
 * Real-world consumers per docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md §4.1
 * (checkout: Contact -> Delivery -> Payment) use `orientation="horizontal"`
 * per docs/05-DESIGN-SYSTEM.md §8 checkout spec ("3-step stepper, minimal
 * chrome, no nav links out"); the PC Builder's step rail
 * (§8 Builder spec: "step rail ‖ slot workspace ‖ sticky summary") uses
 * `orientation="vertical"`. This component doesn't hardcode either list.
 *
 * Per docs/05 §5 A6 ("status never communicated by colour alone") every
 * node pairs its colour treatment with a distinct shape/icon/content:
 * `complete` gets a filled circle *and* a check icon, `current` gets an
 * outlined ring *and* its ordinal number plus `aria-current="step"`, and
 * `upcoming` gets a muted outline *and* its ordinal number at lower tone.
 */
export interface StepperStep {
  label: string;
  status: "complete" | "current" | "upcoming";
}

export interface StepperNavProps {
  steps: StepperStep[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}

function labelClasses(status: StepperStep["status"]): string {
  return cn(
    "text-body-sm",
    status === "complete" && "text-on-surface",
    status === "current" && "text-on-surface font-medium",
    status === "upcoming" && "text-on-surface-variant opacity-70",
  );
}

function StepNode({ status, ordinal }: { status: StepperStep["status"]; ordinal: number }) {
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

export function StepperNav({ steps, orientation = "horizontal", className }: StepperNavProps) {
  const isVertical = orientation === "vertical";

  return (
    <ol
      aria-label="Progress"
      className={cn("list-none", isVertical ? "flex flex-col" : "flex w-full", className)}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const ordinal = index + 1;
        // The line following this step is "solid" once this step itself
        // is complete — i.e. the step before the line has been finished.
        const lineFilled = step.status === "complete";

        if (isVertical) {
          return (
            <li
              key={step.label}
              aria-current={step.status === "current" ? "step" : undefined}
              className="flex items-start"
            >
              <div className="flex flex-col items-center">
                <StepNode status={step.status} ordinal={ordinal} />
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
              <span className={cn(labelClasses(step.status), "ml-3 pt-1.5")}>{step.label}</span>
            </li>
          );
        }

        return (
          <li
            key={step.label}
            aria-current={step.status === "current" ? "step" : undefined}
            className={cn("flex items-start", isLast ? "flex-none" : "flex-1")}
          >
            <div className="flex flex-col items-center gap-2">
              <StepNode status={step.status} ordinal={ordinal} />
              <span className={cn(labelClasses(step.status), "whitespace-nowrap")}>
                {step.label}
              </span>
            </div>
            {!isLast && (
              <span
                aria-hidden="true"
                className={cn(
                  "mx-2 mt-4 h-px flex-1 self-start",
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
