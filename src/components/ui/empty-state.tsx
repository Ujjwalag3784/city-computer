import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * EmptyState — docs/05-DESIGN-SYSTEM.md §7: "Empty: Illustration +
 * plain-language explanation + a primary action ('No products match these
 * filters. Clear filters')." This is the generic, reusable building block
 * that satisfies that requirement platform-wide; it is not a one-off widget
 * for any single feature.
 *
 * `action` accepts a `React.ReactNode` (typically a `Button`) rather than
 * this component importing `Button` directly. `EmptyState` will be reused
 * from many places (catalogue, cart, admin tables, search) each of which may
 * want a different primary action element (link, button, form) — keeping it
 * decoupled avoids a circular-feeling dependency and lets every caller wire
 * up whatever control fits.
 */
export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** A `lucide-react` icon (or any node) rendered large above the title. */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** Typically a `Button`, but any node is accepted — see the doc comment above. */
  action?: React.ReactNode;
}

export const EmptyState = React.forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ className, icon, title, description, action, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col items-center gap-3 py-16 text-center", className)}
      {...props}
    >
      {icon && <div className="mb-1 [&>svg]:size-12 [&>svg]:text-on-surface-variant">{icon}</div>}
      <p className="text-title text-on-surface">{title}</p>
      {description && (
        <p className="max-w-sm text-body-md text-on-surface-variant">{description}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  ),
);
EmptyState.displayName = "EmptyState";
