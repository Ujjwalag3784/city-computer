import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Checkbox — docs/05-DESIGN-SYSTEM.md §6 component inventory: "Checkbox".
 * Wraps Radix's `@radix-ui/react-checkbox` per docs/05 §5 A5 (composite
 * widgets must use Radix, never hand-rolled).
 *
 * The global `:focus-visible` rule in globals.css (docs/05 §5 A3) targets
 * any focused element, so no explicit ring class is needed here — Radix's
 * own outline reset on the root doesn't defeat it since it only clears the
 * default browser outline, not `:focus-visible` specifically.
 */
export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer size-5 shrink-0 rounded-sm border border-glass-stroke transition-colors",
      "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-on-primary",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      <Check className="size-3.5" />
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;
