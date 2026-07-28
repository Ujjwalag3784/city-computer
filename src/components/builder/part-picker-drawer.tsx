"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PartRow, type PartRowData } from "@/components/builder/part-row";
import { cn } from "@/lib/utils";

/**
 * PartPickerDrawer — docs/08-PC-BUILDER-ENGINE.md §9 "Part picker": "a drawer
 * (not a dropdown)... with thumbnails, a spec column set per part type,
 * debounced tokenised fuzzy search, faceted filters, sort including
 * performance-per-rupee, a 2–4 way compare, stock status, and full keyboard
 * + ARIA support."
 *
 * Deliberate simplifications, called out rather than silently skipped:
 * - Fuzzy search, facets, and performance-per-rupee sort are all
 *   backend/catalogue-dependent (they need real spec data and a search
 *   index that don't exist yet — §9's list of features assumes a wired-up
 *   catalogue this codebase doesn't have). This component ships the
 *   search-input + results-list *shell* only: a controlled-or-uncontrolled
 *   text input and a plain list of whatever `parts` it's handed. No fuzzy
 *   matching, faceting, sorting, or compare-selection logic lives here.
 * - **Virtualization**: §9 calls the picker "virtualised". At the time of
 *   writing, `package.json` has no list-virtualization dependency installed
 *   (no `react-window`, `@tanstack/react-virtual`, etc.), and installing a
 *   new dependency is out of scope for this component. The results list
 *   below is therefore a plain scrollable `map()` over `parts` — correct for
 *   small-to-medium result sets, but it will re-render every row and mount
 *   every `<Image>` regardless of scroll position for a large catalogue.
 *   This is an intentional, temporary stand-in: swap the list body for
 *   `@tanstack/react-virtual` (or similar) once real catalogue sizes per
 *   slot type are known, without changing this component's props.
 *
 * Search is controlled via `searchQuery`/`onSearchChange` when the caller
 * supplies both; otherwise the `Input` falls back to local, uncontrolled
 * state so the drawer is still usable stand-alone before real search
 * wiring exists. Either way, this component performs no filtering itself —
 * `parts` is rendered as given, so the caller (or, later, a real search
 * hook) owns actually narrowing the list from `searchQuery`.
 *
 * Built on `Sheet`/`SheetContent side="right"`, widened via `className`
 * (`sm:max-w-lg`) since a part row needs room for a thumbnail, spec column,
 * stock badge, and price — more than the primitive's default `sm:max-w-sm`.
 *
 * `"use client"` — owns local search state (when uncontrolled) and renders
 * `PartRow`s, itself a Client Component with its own `onClick` handlers.
 */
export interface PartPickerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slotLabel: string;
  parts: PartRowData[];
  onSelect: (part: PartRowData) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  className?: string;
}

export function PartPickerDrawer({
  open,
  onOpenChange,
  slotLabel,
  parts,
  onSelect,
  searchQuery,
  onSearchChange,
  className,
}: PartPickerDrawerProps) {
  // Uncontrolled fallback — only used when the caller doesn't supply both
  // `searchQuery` and `onSearchChange`. See JSDoc above: no real search
  // logic exists yet, so this local value currently does nothing but let
  // the input feel interactive stand-alone.
  const [localQuery, setLocalQuery] = useState("");
  const isControlled = typeof searchQuery === "string" && typeof onSearchChange === "function";
  const query = isControlled ? searchQuery : localQuery;

  function handleQueryChange(value: string) {
    if (isControlled) {
      onSearchChange?.(value);
    } else {
      setLocalQuery(value);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn("w-full gap-4 sm:max-w-lg", className)}>
        <SheetHeader>
          <SheetTitle>Choose a {slotLabel}</SheetTitle>
        </SheetHeader>

        <div className="relative">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant"
            aria-hidden="true"
          />
          <Input
            type="search"
            aria-label="Search parts"
            placeholder={`Search ${slotLabel} parts`}
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            className="pl-9"
          />
        </div>

        {/*
         * Plain scrollable list — see the virtualization note in this file's
         * top-level JSDoc. Swap for a virtualized list body once catalogue
         * sizes per slot are known; the surrounding drawer/search shell
         * above does not need to change.
         */}
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {parts.length === 0 ? (
            <p className="py-8 text-center text-body-sm text-on-surface-variant">
              No parts match your search.
            </p>
          ) : (
            parts.map((part) => (
              <PartRow key={part.id} part={part} onSelect={() => onSelect(part)} />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
