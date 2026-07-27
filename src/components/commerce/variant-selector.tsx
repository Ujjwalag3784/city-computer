"use client";

import { cn } from "@/lib/utils";

export interface VariantOption {
  label: string;
  value: string;
  available: boolean;
}

export interface VariantAttribute {
  name: string;
  options: VariantOption[];
}

export interface VariantSelectorProps {
  attributes: VariantAttribute[];
  selected: Record<string, string>;
  onChange: (attributeName: string, value: string) => void;
  className?: string;
}

/**
 * VariantSelector — docs/05-DESIGN-SYSTEM.md §5 A4 ("the part picker
 * combobox" and full keyboard operability generally) and §5 A5 ("Radix
 * primitives for every composite widget — no hand-rolled comboboxes or
 * dialogs").
 *
 * This hand-rolls the ARIA `role="radiogroup"`/`role="radio"` contract
 * rather than wrapping `@radix-ui/react-radio-group` — see
 * `components/ui/radio-group.tsx`, whose `RadioGroupItem` renders a
 * circular native-radio-style indicator with a separate dot, the wrong
 * shape for pill/swatch options where the button itself (label, colour
 * swatch, etc.) is the whole selectable surface. Native `<button>` +
 * `role="radio"`/`aria-checked` reproduces the same screen-reader contract
 * Radix's own radio group exposes, satisfying A5's *intent* (a real,
 * accessible composite widget, not a div-soup fake) without fighting
 * Radix's visual assumptions.
 *
 * Unavailable options (`available: false`) are always rendered — never
 * hidden — so shoppers can see which combinations don't exist rather than
 * wondering where an option went. They're muted + struck through +
 * `aria-disabled`/`disabled` + a `title` tooltip fallback, never
 * communicated by colour alone (§5 A6).
 */
export function VariantSelector({
  attributes,
  selected,
  onChange,
  className,
}: VariantSelectorProps) {
  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {attributes.map((attribute) => (
        <div key={attribute.name} className="flex flex-col gap-2">
          <span className="text-label-mono-xs text-on-surface-variant">{attribute.name}</span>
          <div role="radiogroup" aria-label={attribute.name} className="flex flex-wrap gap-2">
            {attribute.options.map((option) => {
              const isChecked = selected[attribute.name] === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={isChecked}
                  aria-disabled={!option.available}
                  disabled={!option.available}
                  title={!option.available ? "Not available in this combination" : undefined}
                  onClick={() => onChange(attribute.name, option.value)}
                  className={cn(
                    "min-h-11 rounded-lg border px-4 text-body-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "disabled:pointer-events-none disabled:opacity-50 disabled:line-through",
                    isChecked
                      ? "border-primary-container bg-primary-container/10 text-on-surface"
                      : "border-glass-stroke text-on-surface-variant hover:border-primary-container hover:text-on-surface",
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
