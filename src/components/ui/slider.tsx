import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

/**
 * Slider — docs/05-DESIGN-SYSTEM.md §6 component inventory: "Slider".
 * Wraps Radix's `@radix-ui/react-slider` per docs/05 §5 A5. Used for the
 * Shop page's price-range filter (docs/05 §8 Category/Shop page spec).
 *
 * Radix renders multiple thumbs automatically when `value`/`defaultValue`
 * is an array — we map over it to render one `Thumb` per value, the
 * standard shadcn `slider.tsx` pattern, so this component supports both a
 * single-value slider and a two-thumb range slider with no extra props.
 */
export const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>
>(({ className, value, defaultValue, ...props }, ref) => {
  const thumbValues = value ?? defaultValue ?? [0];

  return (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      className={cn(
        "relative flex w-full touch-none items-center",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-surface-container-high">
        <SliderPrimitive.Range className="absolute h-full rounded-full bg-primary-container" />
      </SliderPrimitive.Track>
      {thumbValues.map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          className="block size-5 rounded-full border-2 border-primary-container bg-background shadow-glow transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  );
});
Slider.displayName = SliderPrimitive.Root.displayName;
