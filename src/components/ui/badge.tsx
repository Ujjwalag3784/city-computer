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
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-label-mono-xs transition-colors",
  {
    variants: {
      variant: {
        // DESIGN.md "Pricing Cluster" / status pills: tinted, not solid —
        // coloured text on the same colour at low opacity, so a grid of
        // cards never turns into a wall of saturated blocks.
        primary: "border-primary/30 bg-primary/12 text-primary",
        success: "border-success/30 bg-success/10 text-success",
        warning: "border-warning/30 bg-warning/10 text-warning",
        danger: "border-danger/30 bg-danger/10 text-danger",
        glass: "border-outline-variant bg-surface-container-high text-on-surface-variant",
        // Solid orange — counters (cart badge) that must read at a glance.
        solid: "border-transparent bg-primary text-on-primary",
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
