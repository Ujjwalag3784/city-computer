import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "./button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

/**
 * Calendar — docs/05-DESIGN-SYSTEM.md §6 "Calendar". No consumer exists
 * yet (booking/date-range use cases land later — service-ticket booking,
 * EMI calculator date ranges), so this is deliberately the generic
 * primitive: a token restyle of `react-day-picker`'s `DayPicker`, the same
 * "restyle, don't rebuild" approach as every other file in this folder.
 *
 * `react-day-picker` v9/v10 keys its `classNames` prop by internal part
 * names — `root`, `months`, `month`, `nav`, `button_previous`,
 * `button_next` (not the older v8 `nav_button_previous`/`nav_button_next`
 * naming), `month_caption`, `weekdays`, `weekday`, `week`, `day`,
 * `day_button`, `selected`, `today`, `outside`, `disabled`, `hidden`,
 * `range_start`, `range_middle`, `range_end`. This project's `node_modules`
 * did not have `react-day-picker` installed at write time, so the object
 * below is typed as a loose `Record<string, string>` rather than against
 * the library's exact `classNames` type — an unrecognised key is simply
 * ignored by `DayPicker` at runtime rather than failing a build.
 *
 * Nav buttons reuse `buttonVariants` (the same `cva` `Button` is built
 * from, `variant="ghost" size="sm" iconOnly`) applied through `classNames`,
 * rather than swapping in the `Button` component itself via the `components`
 * prop — `DayPicker` threads its own click/aria-disabled wiring through the
 * default nav button and there is no verified prop contract to match if
 * that element is fully replaced. Only the icon glyph is swapped, via the
 * `Chevron` component override.
 *
 * A plain function component, not `React.forwardRef` — `DayPicker` has no
 * ref-forwarding contract for a single root node (its root element is
 * itself swappable via `components.Root`), so there is nothing for a
 * forwarded ref to attach to.
 */
const defaultClassNames: Record<string, string> = {
  root: "bg-surface-container-high rounded-xl p-3 text-on-surface",
  months: "flex flex-col gap-4 sm:flex-row",
  month: "flex flex-col gap-4",
  month_caption: "relative flex h-9 items-center justify-center pt-1",
  caption_label: "text-body-sm font-medium text-on-surface",
  nav: "absolute inset-x-0 top-0 flex h-9 items-center justify-between",
  button_previous: cn(
    buttonVariants({ variant: "ghost", size: "sm", iconOnly: true }),
    "absolute left-0",
  ),
  button_next: cn(
    buttonVariants({ variant: "ghost", size: "sm", iconOnly: true }),
    "absolute right-0",
  ),
  // Both keys are included defensively — the exact table/grid key name has
  // shifted across react-day-picker majors; an unrecognised key is inert.
  table: "w-full border-collapse",
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday:
    "flex size-9 items-center justify-center text-label-mono-xs font-normal text-on-surface-variant",
  week: "mt-1 flex w-full",
  day: "p-0 text-center",
  day_button: cn(
    "size-9 rounded-full text-body-sm font-normal text-on-surface transition-colors",
    "hover:bg-surface-container-high",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container",
    "focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container-high",
    "disabled:pointer-events-none disabled:opacity-50",
  ),
  selected: "bg-primary text-on-primary hover:bg-primary hover:text-on-primary",
  today: "border border-primary-container",
  outside: "text-on-surface-variant opacity-50",
  disabled: "pointer-events-none text-on-surface-variant opacity-50",
  hidden: "invisible",
  range_start: "rounded-l-full bg-primary text-on-primary",
  range_middle: "rounded-none bg-surface-container-highest text-on-surface",
  range_end: "rounded-r-full bg-primary text-on-primary",
};

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: CalendarProps) {
  const mergedClassNames: Record<string, string> = { ...defaultClassNames };
  for (const [key, value] of Object.entries(classNames ?? {})) {
    if (value) {
      // key is bounded to react-day-picker's own `classNames` prop keys (typed,
      // developer-supplied), not arbitrary user input.
      // eslint-disable-next-line security/detect-object-injection
      mergedClassNames[key] = cn(mergedClassNames[key], value);
    }
  }

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={className}
      classNames={mergedClassNames as CalendarProps["classNames"]}
      components={{
        Chevron: ({ className: chevronClassName, orientation }) => {
          if (orientation === "left") {
            return <ChevronLeft className={cn("size-4", chevronClassName)} />;
          }
          if (orientation === "right") {
            return <ChevronRight className={cn("size-4", chevronClassName)} />;
          }
          return <ChevronDown className={cn("size-4", chevronClassName)} />;
        },
        ...components,
      }}
      {...props}
    />
  );
}
