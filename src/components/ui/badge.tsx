import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Badge — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "Badge (primary/success/warning/danger/glass)".
 *
 * `rounded-full` is a true pill here (docs/05 §3 — the corrected radius
 * scale restores `rounded-full` to 9999px after the Stitch-export bug that
 * remapped it to a 12px panel radius, which would have silently broken
 * every status chip).
 *
 * Per docs/05 §1.5 ("Every status must be conveyed by icon + text, never
 * colour alone") the root is `inline-flex items-center gap-1` so a caller
 * can prefix an icon before the label, e.g.
 * `<Badge variant="success"><CheckCircle className="size-3" />In stock</Badge>`.
 * This component does not force an icon — it just makes adding one natural.
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-label-mono-xs transition-colors",
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary",
        success: "bg-success text-on-success",
        warning: "bg-warning text-on-warning",
        danger: "bg-danger text-on-danger",
        glass: "glass-panel text-on-surface",
      },
    },
    defaultVariants: {
      variant: "primary",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <span ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
);
Badge.displayName = "Badge";

export { badgeVariants };
