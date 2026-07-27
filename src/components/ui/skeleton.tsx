import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Skeleton — docs/05-DESIGN-SYSTEM.md §7: "Loading: Skeleton matching the
 * final layout — never a spinner where content will appear." This is the
 * generic, reusable building block that satisfies that requirement
 * platform-wide; it is not a one-off widget for any single feature.
 *
 * It has no intrinsic size — callers must shape it with `className` to
 * match whatever real content it stands in for, e.g.
 * `<Skeleton className="h-4 w-32" />` for a text line, or
 * `<Skeleton className="aspect-square rounded-xl" />` for a product image
 * placeholder. A skeleton that doesn't match the final layout defeats the
 * point of this rule.
 */
export const Skeleton = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("animate-pulse rounded-md bg-surface-container-high", className)}
      {...props}
    />
  ),
);
Skeleton.displayName = "Skeleton";
