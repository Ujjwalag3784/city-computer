"use client";

import { CommandEmpty, CommandGroup, CommandItem } from "@/components/ui/command";
import { cn } from "@/lib/utils";

/**
 * GlobalSearch — docs/09-ADMIN-DAD-MODE.md §9 "Global search": typing "HP"
 * returns grouped results immediately —
 * `PRODUCTS (12)` ... `ORDERS (3)` ... `CUSTOMERS (2)` ...
 * `BRANDS (1) · CATEGORIES (1) · DISCOUNT CODES (0)` ...
 * `BLOG POSTS (1) · REPAIR JOBS (0) · PC BUILDS (2)`.
 * "Order numbers, phone numbers, and product codes match exactly and jump
 * straight to the record. Results are permission-filtered. Debounced
 * 200ms, p95 < 150ms."
 *
 * This is ONLY the results-rendering half of that contract. It is meant to
 * be dropped inside `AdminTopBar`'s existing `CommandDialog`/`CommandList`
 * shell (`src/components/admin/admin-topbar.tsx`), in place of that file's
 * current placeholder `CommandEmpty`, in a later page-wiring phase — this
 * component does not touch `admin-topbar.tsx` itself. It receives
 * already-fetched, already-grouped `groups` as a prop and renders them; it
 * does NOT fetch, debounce, permission-filter, or otherwise implement any
 * of §9's search behaviour itself. A real search endpoint and the 200ms
 * debounce belong to a future data-wiring phase — nothing here should be
 * mistaken for a live-search implementation.
 *
 * Group headings render as `"{LABEL} (count)"` in upper case, e.g.
 * `PRODUCTS (12)` — a deliberate exception to this codebase's normal
 * sentence-case UI copy (docs/05-DESIGN-SYSTEM.md's house style
 * elsewhere). It mirrors §9's own command-palette-style example verbatim,
 * not regular page copy, so a future pass should not "fix" this to
 * sentence case.
 *
 * `"use client"`: `CommandItem`'s `onSelect` below is wired directly to a
 * `cmdk`-boundary component — `cmdk` marks its own package "use client"
 * (the same boundary `ui/command.tsx`'s Radix/cmdk re-exports already rely
 * on), so attaching a callback to it here can't cross from a Server
 * Component, the same reasoning `builder/issue-row.tsx` documents for
 * wiring a handler onto a raw host element. This file otherwise holds no
 * local state — `Command`'s own internals (from `cmdk`) already own
 * keyboard navigation and roving focus.
 */
export interface GlobalSearchGroup {
  label: string;
  count: number;
  results: { id: string; title: string; subtitle?: string; href: string }[];
}

export interface GlobalSearchProps {
  groups: GlobalSearchGroup[];
  onSelect: (href: string) => void;
  emptyMessage?: string;
  className?: string;
}

export function GlobalSearch({
  groups,
  onSelect,
  emptyMessage = "No results found.",
  className,
}: GlobalSearchProps) {
  const hasResults = groups.some((group) => group.results.length > 0);

  if (!hasResults) {
    return <CommandEmpty>{emptyMessage}</CommandEmpty>;
  }

  return (
    // `display: contents` keeps this wrapper out of the box tree so
    // `CommandGroup`s behave as if they were direct children of
    // `CommandList` (cmdk's own spacing/scroll assumptions), while still
    // giving callers a place to hang an optional `className`.
    <div className={cn("contents", className)}>
      {groups.map((group) => (
        <CommandGroup key={group.label} heading={`${group.label.toUpperCase()} (${group.count})`}>
          {group.results.map((result) => (
            <CommandItem
              key={result.id}
              value={result.title}
              onSelect={() => onSelect(result.href)}
            >
              <div className="flex flex-col">
                <span>{result.title}</span>
                {result.subtitle && (
                  <span className="text-label-mono-xs text-on-surface-variant">
                    {result.subtitle}
                  </span>
                )}
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      ))}
    </div>
  );
}
