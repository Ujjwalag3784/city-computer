import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Textarea — docs/05-DESIGN-SYSTEM.md §6 component inventory: "Textarea".
 *
 * Same visual language and `error` prop pattern as `input.tsx` — see that
 * file's doc comment for the `error`/`aria-invalid` pairing note (docs/05
 * §5 A10). Resizes vertically only; horizontal resize would break layouts
 * that assume a fixed field width.
 */
export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  /** Swaps the border to `border-error`. Pair with `aria-invalid` on the consumer side. */
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error = false, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "flex min-h-24 w-full resize-y rounded border bg-surface-container px-3 py-2 text-body-md text-on-surface transition-colors",
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
Textarea.displayName = "Textarea";
