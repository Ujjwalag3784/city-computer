"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * QuantityStepper — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "QuantityStepper ([-] [n] [+])". The `-`/`+` controls are the shared
 * `Button` primitive (`variant="ghost"` `iconOnly`) so press/focus/disabled
 * treatment matches every other button in the system (docs/05 §4
 * "active:scale-[0.98]" is already baked into `Button`).
 *
 * Per docs/05 §5 A9 ("44x44 minimum touch target for every interactive
 * element") both icon buttons use `size="md"` (44px square, `Button`'s
 * `compoundVariants` map `size=md`+`iconOnly` to `size-11`).
 *
 * The numeric field is a bare styled `<input>` rather than `@/components/ui/
 * Input` — `Input` bakes in its own `rounded border bg-surface-container
 * px-3`, which fights the pill-group's own border/background instead of
 * composing with it, so a minimal native `<input type="number">` is used
 * here for full control over the borderless, centered middle cell.
 *
 * The field is editable directly and clamped to `[min, max]` (as an integer
 * multiple of `step` from `min`) on blur/Enter — never on every keystroke,
 * so the user can freely retype a value without fighting the clamp.
 */
export interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
}

function clampToStep(raw: number, min: number, max: number, step: number): number {
  if (!Number.isFinite(raw)) return min;
  const clamped = Math.min(max, Math.max(min, raw));
  const stepsFromMin = Math.round((clamped - min) / step);
  return min + stepsFromMin * step;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  step = 1,
  disabled = false,
  className,
}: QuantityStepperProps) {
  const [draft, setDraft] = React.useState(String(value));

  // Keep the editable draft in sync whenever the committed value changes
  // from outside (e.g. a parent resetting quantity after a variant swap).
  React.useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = React.useCallback(
    (raw: string) => {
      const parsed = clampToStep(Math.trunc(Number(raw)), min, max, step);
      setDraft(String(parsed));
      if (parsed !== value) onChange(parsed);
    },
    [min, max, step, value, onChange],
  );

  return (
    <div className={cn("inline-flex items-center rounded border border-glass-stroke", className)}>
      <Button
        type="button"
        variant="ghost"
        size="md"
        iconOnly
        aria-label="Decrease quantity"
        disabled={disabled || value <= min}
        onClick={() => commit(String(value - step))}
        className="rounded-r-none"
      >
        <Minus aria-hidden="true" />
      </Button>
      <input
        type="number"
        inputMode="numeric"
        aria-label="Quantity"
        value={draft}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={(event) => commit(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commit(event.currentTarget.value);
        }}
        className={cn(
          "h-11 w-12 border-0 bg-transparent text-center text-body-md text-on-surface",
          "focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        )}
      />
      <Button
        type="button"
        variant="ghost"
        size="md"
        iconOnly
        aria-label="Increase quantity"
        disabled={disabled || value >= max}
        onClick={() => commit(String(value + step))}
        className="rounded-l-none"
      >
        <Plus aria-hidden="true" />
      </Button>
    </div>
  );
}
