import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utils";

/**
 * Label — wraps Radix's `@radix-ui/react-label` Root.
 *
 * ADDED, not in the Stitch designs / docs/05 §6 primitives list — required
 * by docs/05-DESIGN-SYSTEM.md §5 A10 ("Forms: <label> for every field") and
 * a dependency of every other form primitive in this batch.
 */
export const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-body-sm font-medium text-on-surface",
      "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  />
));
Label.displayName = LabelPrimitive.Root.displayName;
