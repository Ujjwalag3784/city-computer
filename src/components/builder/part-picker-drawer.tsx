"use client";

import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PartRow, type PartRowData } from "@/components/builder/part-row";
import { cn } from "@/lib/utils";

/**
 * PartPickerDrawer — docs/08-PC-BUILDER-ENGINE.md §9 "Part picker": "a drawer
 * (not a dropdown)... virtualised (a 513-row case list must not lag), with
 * thumbnails, a spec column set per part type, debounced tokenised fuzzy
 * search, faceted filters, sort including performance-per-rupee, a 2–4 way
 * compare, stock status, and full keyboard + ARIA support."
 *
 * Deliberate simplifications, called out rather than silently skipped:
 * - Fuzzy search, facets, and performance-per-rupee sort are all
 *   backend/catalogue-dependent (they need real spec data and a search
 *   index that don't exist yet — §9's list of features assumes a wired-up
 *   catalogue this codebase doesn't have). This component ships the
 *   search-input + results-list *shell* only: a controlled-or-uncontrolled
 *   text input and a plain list of whatever `parts` it's handed. No fuzzy
 *   matching, faceting, sorting, or compare-selection logic lives here.
 *
 * **Virtualization**: now real, via `@tanstack/react-virtual`'s
 * `useVirtualizer` — this is the swap-in the file's own JSDoc previously
 * flagged as a future step, landed without changing any of this
 * component's exported props (`PartPickerDrawerProps` is untouched).
 * `getScrollElement` points at the results container (`parentRef`); each
 * row is measured dynamically via `measureElement` rather than assuming a
 * fixed height, since `PartRow` can render a taller "incompatible" variant
 * (an extra reason line) — `estimateSize` only seeds the initial guess
 * before the real DOM heights are known. `overscan` renders a handful of
 * off-screen rows above/below the viewport so fast scrolling doesn't show
 * blank frames.
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
 * `"use client"` — owns local search state (when uncontrolled), the
 * virtualizer's scroll-container ref, and renders `PartRow`s, itself a
 * Client Component with its own `onClick` handlers.
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

/** Seed height (px) for a not-yet-measured row — a plain `PartRow` is ~72px (min-h-11 thumbnail + padding); the real height is measured per-row once mounted, so this only affects the very first paint's scrollbar estimate. */
const ESTIMATED_ROW_HEIGHT_PX = 80;
/** Rows rendered outside the visible viewport in each direction, so fast scrolling/keyboard paging doesn't flash blank space before the next row mounts. */
const OVERSCAN_ROWS = 6;

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

  const scrollParentRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: parts.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT_PX,
    overscan: OVERSCAN_ROWS,
  });

  function handleQueryChange(value: string) {
    if (isControlled) {
      onSearchChange?.(value);
    } else {
      setLocalQuery(value);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("flex w-full flex-col gap-4 sm:max-w-lg", className)}
      >
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

        {parts.length === 0 ? (
          <p className="py-8 text-center text-body-sm text-on-surface-variant">
            No parts match your search.
          </p>
        ) : (
          <div ref={scrollParentRef} className="flex-1 overflow-y-auto">
            <div
              style={{ height: virtualizer.getTotalSize(), position: "relative", width: "100%" }}
            >
              {virtualizer.getVirtualItems().map((virtualRow) => {
                const part = parts[virtualRow.index];
                if (!part) return null;
                return (
                  <div
                    key={part.id}
                    ref={virtualizer.measureElement}
                    data-index={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="pb-2"
                  >
                    <PartRow part={part} onSelect={() => onSelect(part)} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
