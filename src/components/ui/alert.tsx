import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

/**
 * Alert — docs/05-DESIGN-SYSTEM.md §6 component inventory: "Alert".
 * No Radix primitive exists for this; `role="alert"` on the root is what
 * ties it into docs/05 §5 A10's form-error pattern
 * (`aria-invalid` + `role="alert"`) and the general error-state guidance
 * in §7 ("Error: Human message + retry + a support route. Never a raw
 * error string.").
 *
 * Layout follows the well-known shadcn `alert.tsx` trick: the consumer
 * passes an icon as the first child of `Alert`, and `[&>svg]:absolute
 * [&>svg]:left-4 [&>svg]:top-4` + `pl-11` position it without a dedicated
 * icon prop. This also satisfies docs/05 §1.5 (status by icon + text, never
 * colour alone) for the success/warning/destructive variants.
 */
const alertVariants = cva(
  [
    "relative w-full rounded-xl border p-4 text-body-sm",
    "[&>svg]:absolute [&>svg]:left-4 [&>svg]:top-4 [&>svg]:size-4",
    "[&>svg~*]:pl-7 pl-11",
  ],
  {
    variants: {
      variant: {
        default:
          "bg-surface-container border-glass-stroke text-on-surface [&>svg]:text-on-surface-variant",
        success: "bg-success/10 border-success text-success [&>svg]:text-success",
        warning: "bg-warning/10 border-warning text-warning [&>svg]:text-warning",
        destructive: "bg-danger/10 border-danger text-danger [&>svg]:text-danger",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof alertVariants> {}

export const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props} />
  ),
);
Alert.displayName = "Alert";

export const AlertTitle = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLHeadingElement>
>(({ className, children, ...props }, ref) => (
  <h5
    ref={ref}
    className={cn("mb-1 font-medium leading-none tracking-tight text-on-surface", className)}
    {...props}
  >
    {children}
  </h5>
));
AlertTitle.displayName = "AlertTitle";

export const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-body-sm text-on-surface-variant [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { alertVariants };
