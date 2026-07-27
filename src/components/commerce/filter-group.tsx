"use client";

import { Check } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";

/**
 * FilterGroup — docs/05-DESIGN-SYSTEM.md §8 Category/Shop page spec: the
 * building block `FilterRail` and `MobileFilterSheet` both render one-or-
 * many of, one per facet (brand, category, price, etc). A discriminated
 * union keyed on `type` because each filter type's value/options shape
 * genuinely differs — a multi-select list, a single-select choice, a
 * numeric range, and a toggle-button group are not the same data shape
 * wearing different clothes.
 *
 * Every control is a real, labelled, keyboard-operable native/Radix form
 * control — docs/05 §5 A4 explicitly calls out "the filter rail" as
 * somewhere the original designs failed keyboard operability, so nothing
 * here is a hand-rolled div with an `onClick` and no semantics.
 *
 * `FilterGroup` itself does not render its own collapsible affordance —
 * wrapping a group's title/content in an `AccordionItem` is the caller's
 * job (`FilterRail`, `MobileFilterSheet`).
 *
 * `Slider` (`@/components/ui/slider`) already supports a two-thumb range
 * natively — it maps over whatever array is passed as `value`/
 * `defaultValue` and renders one `Thumb` per entry — so the `"range"`
 * variant below passes `[min, max]` straight through rather than
 * synthesising two single sliders or falling back to number inputs.
 */
export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export type FilterGroupProps =
  | {
      type: "checkbox";
      title: string;
      options: FilterOption[];
      selected: string[];
      onChange: (selected: string[]) => void;
    }
  | {
      type: "radio";
      title: string;
      options: FilterOption[];
      selected: string | null;
      onChange: (value: string) => void;
    }
  | {
      type: "range";
      title: string;
      min: number;
      max: number;
      value: [number, number];
      onChange: (value: [number, number]) => void;
      formatValue?: (n: number) => string;
    }
  | {
      type: "chip" | "pill";
      title: string;
      options: Pick<FilterOption, "label" | "value">[];
      selected: string[];
      onChange: (selected: string[]) => void;
    };

function toggleValue(current: string[], value: string): string[] {
  return current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value];
}

const groupHeadingClass = "text-body-md text-on-surface";

export function FilterGroup(props: FilterGroupProps) {
  const { title } = props;

  if (props.type === "checkbox") {
    const { options, selected, onChange } = props;
    return (
      <div className="flex flex-col gap-3">
        <p className={groupHeadingClass}>{title}</p>
        <ul className="flex flex-col gap-3">
          {options.map((option) => {
            const id = `filter-checkbox-${title}-${option.value}`;
            const checked = selected.includes(option.value);
            return (
              <li key={option.value} className="flex min-h-11 items-center gap-2.5">
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={(next) =>
                    onChange(
                      next
                        ? [...selected, option.value]
                        : selected.filter((v) => v !== option.value),
                    )
                  }
                />
                <label htmlFor={id} className="flex-1 text-body-sm text-on-surface">
                  {option.label}
                  {typeof option.count === "number" && (
                    <span className="ml-1 text-on-surface-variant">({option.count})</span>
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  if (props.type === "radio") {
    const { options, selected, onChange } = props;
    return (
      <div className="flex flex-col gap-3">
        <p className={groupHeadingClass}>{title}</p>
        <RadioGroup value={selected ?? undefined} onValueChange={onChange}>
          {options.map((option) => {
            const id = `filter-radio-${title}-${option.value}`;
            return (
              <div key={option.value} className="flex min-h-11 items-center gap-2.5">
                <RadioGroupItem id={id} value={option.value} />
                <label htmlFor={id} className="flex-1 text-body-sm text-on-surface">
                  {option.label}
                  {typeof option.count === "number" && (
                    <span className="ml-1 text-on-surface-variant">({option.count})</span>
                  )}
                </label>
              </div>
            );
          })}
        </RadioGroup>
      </div>
    );
  }

  if (props.type === "range") {
    const { min, max, value, onChange, formatValue } = props;
    const format = formatValue ?? ((n: number) => String(n));
    return (
      <div className="flex flex-col gap-4">
        <p className={groupHeadingClass}>{title}</p>
        <Slider
          min={min}
          max={max}
          value={value}
          onValueChange={(next) => onChange([next[0] ?? value[0], next[1] ?? value[1]])}
          aria-label={title}
        />
        <div className="flex items-center justify-between text-body-sm text-on-surface-variant">
          <span>{format(value[0])}</span>
          <span>{format(value[1])}</span>
        </div>
      </div>
    );
  }

  // "chip" | "pill"
  const { options, selected, onChange, type } = props;
  return (
    <div className="flex flex-col gap-3">
      <p className={groupHeadingClass}>{title}</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label={title}>
        {options.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onChange(toggleValue(selected, option.value))}
              className={cn(
                "inline-flex h-11 min-h-11 items-center gap-1.5 border px-4 text-body-sm font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                type === "pill" ? "rounded-full" : "rounded",
                isSelected
                  ? "border-primary-container bg-primary-container text-on-primary-container"
                  : "border-glass-stroke bg-transparent text-on-surface hover:bg-surface-container-high",
              )}
            >
              {isSelected && <Check className="size-3.5" aria-hidden="true" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
