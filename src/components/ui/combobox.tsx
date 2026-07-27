"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./command";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

/**
 * Combobox — docs/05-DESIGN-SYSTEM.md §6 "Combobox". Also the generic
 * version of the widget named directly in docs/05 §5 A4 ("full keyboard
 * operability: ... the part picker combobox"): the well-known shadcn/ui
 * Combobox recipe, a composed *pattern* rather than a Radix primitive of
 * its own — `Popover` (docs/05 §6) supplies the positioned overlay and
 * focus trap, `Command` (this folder's `command.tsx`, wrapping `cmdk`)
 * supplies keyboard nav and filtering. The later PC-builder part picker is
 * a separate, later domain component that will consume this generic
 * primitive; this file only builds the reusable shape.
 *
 * A plain function component, not `React.forwardRef` — there is no single
 * DOM node for a forwarded ref to usefully attach to (the trigger button,
 * the search input, and the option list are three separate elements),
 * matching the shape of the upstream shadcn recipe. It does need its own
 * `open` state to close the popover on selection, so this file — unlike
 * the pure Radix re-exports elsewhere in this folder — needs its own
 * "use client" boundary.
 */
export interface ComboboxOption {
  value: string;
  label: string;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
  disabled?: boolean;
  "aria-label"?: string;
}

export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Select an option...",
  emptyText = "No results found.",
  className,
  disabled = false,
  ...props
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
          {...props}
        >
          <span className={cn("truncate", !selected && "text-on-surface-variant")}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 text-on-surface-variant" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange?.(option.value === value ? "" : option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn("size-4", option.value === value ? "opacity-100" : "opacity-0")}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
