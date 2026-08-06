import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Card / GlassPanel — docs/05-DESIGN-SYSTEM.md §6: "Card/GlassPanel (blur,
 * borderTone)". One component, two rendering modes: a solid tonal surface
 * (default) or a translucent glass panel (`variant="glass"`), since the
 * exports define three different glass-panel recipes and docs/05 §1.6
 * collapses them to one (`--glass-bg` / `--glass-blur`).
 *
 * PADDING SYNTAX, do not "simplify" back: `p-(--space-card-padding)`, with
 * parentheses. These utilities were originally written with square brackets
 * instead, which is the Tailwind **v3** shorthand for a bare variable. v4
 * removed it (upgrade guide, "Using variables in arbitrary values") and
 * emits the value verbatim, so every card in the app was shipping
 * `padding: --space-card-padding` — an invalid declaration the browser
 * drops on the floor. That is why `/auth/login` rendered with its heading,
 * inputs and button flush against the card border, and it was never
 * specific to that page. `p-(--…)` is v4's shorthand for
 * `p-[var(--…)]` and produces the intended 24px from globals.css.
 *
 * Known remaining instances of the v3 form elsewhere (all the same bug,
 * none load-bearing for the auth pages, so left for a separate sweep):
 * `grep -rn -- '-\[--' src`.
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "surface" | "glass";
  /** Border tone — default is the standard glass stroke; "primary" is the hover/active accent border. */
  borderTone?: "default" | "primary" | "none";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, variant = "surface", borderTone = "default", ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-xl text-on-surface transition-colors",
        variant === "glass" ? "glass-panel" : "bg-surface-container",
        borderTone === "default" && "border border-glass-stroke",
        borderTone === "primary" && "border border-primary-container shadow-glow",
        borderTone === "none" && "border-0",
        className,
      )}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex flex-col gap-1.5 p-(--space-card-padding)", className)}
      {...props}
    />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h3 ref={ref} className={cn("text-title text-on-surface", className)} {...props}>
    {children}
  </h3>
));
CardTitle.displayName = "CardTitle";

export const CardDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("text-body-sm text-on-surface-variant", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div className={cn("p-(--space-card-padding) pt-0", className)} ref={ref} {...props} />
  ),
);
CardContent.displayName = "CardContent";

export const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center p-(--space-card-padding) pt-0", className)}
      {...props}
    />
  ),
);
CardFooter.displayName = "CardFooter";
