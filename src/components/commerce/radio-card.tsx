import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

/**
 * RadioCard — docs/05-DESIGN-SYSTEM.md §6 component inventory: "RadioCard",
 * a full card-styled radio option for delivery-zone / payment-method
 * choices, built on `@radix-ui/react-radio-group` per docs/05 §5 A5.
 *
 * `@/components/ui/radio-group`'s `RadioGroupItem` was checked first: it
 * only forwards `className` and `...props` to `RadioGroupPrimitive.Item`,
 * but its own JSX hardcodes a single dot-only `RadioGroupPrimitive.
 * Indicator` as that Item's *only* child — it never reads or renders a
 * `children` prop. Wrapping it here would silently drop all card content
 * (title/description/trailing) and leave a bare restyled dot. It's also a
 * requirement here that the *entire* card — not just the dot — is the
 * clickable/focusable radio hit area (docs/05 §5 A9, 44x44 minimum), which
 * needs the Item itself to be the full-width sized element. So this
 * component drops down to the raw `RadioGroupPrimitive.Item` directly
 * instead of composing that wrapper.
 *
 * This is a single **item**, not a `RadioGroup.Root` — compose one or more
 * inside the existing `RadioGroup` primitive from `@/components/ui/
 * radio-group`:
 * ```tsx
 * <RadioGroup value={value} onValueChange={setValue}>
 *   <RadioCard value="a" title="Option A" />
 *   <RadioCard value="b" title="Option B" description="Extra detail" />
 * </RadioGroup>
 * ```
 *
 * Per docs/05 §5 A6 ("status never communicated by colour alone") the
 * checked state pairs a border/background colour change with the radio
 * dot itself filling in — never a colour-only signal.
 */
export interface RadioCardProps {
  value: string;
  title: string;
  description?: string;
  trailing?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const RadioCard = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  RadioCardProps
>(({ value, title, description, trailing, disabled, className }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    value={value}
    disabled={disabled}
    className={cn(
      "group flex min-h-11 w-full items-center gap-3 rounded border border-glass-stroke bg-surface-container px-4 py-3 text-left transition-colors",
      "hover:border-primary-container",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
      "disabled:cursor-not-allowed disabled:opacity-50",
      "data-[state=checked]:border-primary-container data-[state=checked]:bg-primary-container/5",
      className,
    )}
  >
    <span
      aria-hidden="true"
      className="flex size-5 shrink-0 items-center justify-center rounded-full border border-glass-stroke transition-colors group-data-[state=checked]:border-primary-container"
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <span className="size-2.5 rounded-full bg-primary-container" />
      </RadioGroupPrimitive.Indicator>
    </span>
    <span className="flex flex-1 flex-col gap-0.5 text-left">
      <span className="text-body-md font-medium text-on-surface">{title}</span>
      {description && <span className="text-body-sm text-on-surface-variant">{description}</span>}
    </span>
    {trailing && <span className="shrink-0">{trailing}</span>}
  </RadioGroupPrimitive.Item>
));
RadioCard.displayName = "RadioCard";
