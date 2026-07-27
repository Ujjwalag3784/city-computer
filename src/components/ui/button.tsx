import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Restyled shadcn Button — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "Button (primary/ghost/outline/mono/destructive/icon × sm/md/lg × glow)".
 *
 * `glow` is a separate boolean, not a seventh variant — it layers
 * `shadow-glow-strong` on hover/focus on top of whichever variant/size is
 * chosen (docs/05 §1.6, §4 "Card hover: border -> primary-container,
 * shadow-glow").
 *
 * Every state required by docs/05 §7 (default/hover/active/focus-visible/
 * disabled) is covered by Tailwind's built-in `hover:`/`active:`/
 * `focus-visible:`/`disabled:` variants below — no separate "state" prop.
 */
const buttonVariants = cva(
  [
    "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded",
    "text-body-sm font-medium transition-colors",
    "disabled:pointer-events-none disabled:opacity-50",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "active:scale-[0.98]",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0",
  ],
  {
    variants: {
      variant: {
        primary: "bg-primary text-on-primary hover:bg-primary/90",
        ghost: "bg-transparent text-on-surface hover:bg-surface-container-high",
        outline:
          "border border-glass-stroke bg-transparent text-on-surface hover:bg-surface-container-high hover:border-primary-container",
        mono: "bg-surface-container text-on-surface font-mono hover:bg-surface-container-high",
        destructive: "bg-error text-on-error hover:bg-error/90",
        icon: "bg-transparent text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface",
      },
      size: {
        sm: "h-9 px-3 text-body-sm [&_svg]:size-4",
        md: "h-11 px-4 text-body-md [&_svg]:size-4",
        lg: "h-12 px-6 text-body-lg [&_svg]:size-5",
      },
      glow: {
        true: "hover:shadow-glow-strong focus-visible:shadow-glow-strong",
        false: "",
      },
      /** icon-only square buttons need equal padding, not the text padding above */
      iconOnly: {
        true: "aspect-square p-0",
        false: "",
      },
    },
    compoundVariants: [
      { size: "sm", iconOnly: true, class: "size-9" },
      { size: "md", iconOnly: true, class: "size-11" },
      { size: "lg", iconOnly: true, class: "size-12" },
    ],
    defaultVariants: {
      variant: "primary",
      size: "md",
      glow: false,
      iconOnly: false,
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Renders the child element (e.g. a Link) with the button's classes instead of a <button>. */
  asChild?: boolean;
  /**
   * True for a square icon-only button. Required whenever there is no
   * visible text label, alongside `aria-label` — docs/05 §5 A2: "Every
   * icon-only button has an aria-label. The exports have none."
   */
  iconOnly?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, glow, iconOnly, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size, glow, iconOnly }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { buttonVariants };
