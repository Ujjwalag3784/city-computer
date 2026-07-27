"use client";

import { SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FilterGroup, type FilterGroupProps } from "@/components/commerce/filter-group";

/**
 * MobileFilterSheet — docs/05-DESIGN-SYSTEM.md §8 Category/Shop page spec:
 * "<lg: [filter button → sheet, 2-col grid]". This is the `<lg` counterpart
 * to `FilterRail`'s desktop 288px sticky rail, not a responsive variant of
 * it — the two are siblings the page picks between at the `lg` breakpoint.
 *
 * Owns rendering its own trigger button, same pattern as `MobileNav` in the
 * layout batch (`src/components/layout/mobile-nav.tsx`): a caller just
 * drops in `<MobileFilterSheet groups={...} onClearAll={...} />` and gets
 * both the "Filters" button and the sheet it opens — there is exactly one
 * place the trigger and its panel can drift out of sync.
 *
 * `"use client"`: renders Radix's `Dialog`-backed `Sheet`, which needs the
 * browser to manage open/closed state, same as `MobileNav`.
 *
 * `side="bottom"` rather than a side drawer — a bottom sheet reads more
 * naturally for a filter list on mobile and leaves room for the sticky
 * "Show N results" footer bar. The sheet is left uncontrolled (Radix's own
 * internal open state, same as `MobileNav`); the "Show results" button
 * closes it via `SheetClose asChild` rather than lifted `open` state.
 *
 * The "accordion of filter groups" markup here intentionally mirrors
 * `FilterRail`'s — kept as plain duplication rather than a shared helper,
 * since the two files are small enough that the duplication costs less
 * than the cross-file coupling a shared export would add.
 */
export interface MobileFilterSheetProps {
  groups: FilterGroupProps[];
  onClearAll: () => void;
  resultCount?: number;
  className?: string;
}

export function MobileFilterSheet({
  groups,
  onClearAll,
  resultCount,
  className,
}: MobileFilterSheetProps) {
  const openValues = groups.map((group) => group.title);

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="md" className={className}>
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          Filters
        </Button>
      </SheetTrigger>

      <SheetContent side="bottom" className="max-h-[85vh] gap-0 overflow-hidden p-0">
        <SheetHeader className="border-b border-glass-stroke px-6 py-4 text-left">
          <SheetTitle>Filters</SheetTitle>
        </SheetHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">
          <Accordion type="multiple" defaultValue={openValues}>
            {groups.map((group) => (
              <AccordionItem key={group.title} value={group.title}>
                <AccordionTrigger>{group.title}</AccordionTrigger>
                <AccordionContent>
                  <FilterGroup {...group} />
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-glass-stroke px-6 py-4">
          <Button variant="ghost" onClick={onClearAll}>
            Clear all
          </Button>
          <SheetClose asChild>
            <Button variant="primary">
              {typeof resultCount === "number" ? `Show ${resultCount} results` : "Show results"}
            </Button>
          </SheetClose>
        </div>
      </SheetContent>
    </Sheet>
  );
}
