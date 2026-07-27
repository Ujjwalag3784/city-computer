import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Input — docs/05-DESIGN-SYSTEM.md §6 component inventory: "Input".
 *
 * Plain styled `<input>`, no Radix primitive needed. States per docs/05 §7:
 * default/hover/focus-visible/disabled are covered below; `error` covers
 * the error state. `error` only swaps the border colour — the consumer is
 * responsible for also passing `aria-invalid="true"` (and pairing the field
 * with `aria-describedby` pointing at a `role="alert"` message) per
 * docs/05 §5 A10, since this component just spreads `InputHTMLAttributes`
 * and has no knowledge of the surrounding form field's error message.
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Swaps the border to `border-error`. Pair with `aria-invalid` on the consumer side — see doc comment above. */
  error?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error = false, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "flex h-11 w-full rounded border bg-surface-container px-3 text-body-md text-on-surface transition-colors",
        "placeholder:text-on-surface-variant",
        "border-glass-stroke",
        "focus-visible:outline-none focus-visible:border-primary-container focus-visible:shadow-glow",
        "disabled:cursor-not-allowed disabled:opacity-50",
        error && "border-error",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
