import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { FilterGroup, type FilterGroupProps } from "@/components/commerce/filter-group";
import { cn } from "@/lib/utils";

/**
 * FilterRail — docs/05-DESIGN-SYSTEM.md §8 Category/Shop page spec:
 * "lg: [288px sticky filter rail ‖ 3-col grid]". This renders the desktop
 * half of that contract only — the `<lg` equivalent is `MobileFilterSheet`,
 * a separate component, not a responsive variant of this one.
 *
 * No `"use client"` needed here: `Accordion` is Radix-backed and manages
 * its own client-side open/close state internally, and `FilterGroup`'s
 * variants each carry their own `"use client"` boundary — this file is a
 * plain composition with no local state of its own.
 *
 * `288px` ≈ Tailwind's `w-72`. The sticky offset uses the real `--nav-h`
 * CSS variable (`globals.css`, already exposed as the `nav-height`
 * utility elsewhere) plus a little breathing room, so the rail settles
 * just below the sticky header rather than under it.
 *
 * Each filter group is wrapped in an `AccordionItem` (docs/05 §6 Accordion)
 * so every facet is individually collapsible, defaulting to all sections
 * open via the standard shadcn `type="multiple"` pattern with every
 * group's title pre-selected as an open value.
 *
 * Always renders a persistent "Clear filters" action — docs/05 §7's empty
 * state requirement ("No products match these filters. Clear filters") is
 * the *page's* concern to render when the grid is empty, but that empty
 * state needs something to point to; this is that anchor, not the empty
 * state itself.
 */
export interface FilterRailProps {
  groups: FilterGroupProps[];
  onClearAll: () => void;
  className?: string;
}

export function FilterRail({ groups, onClearAll, className }: FilterRailProps) {
  const openValues = groups.map((group) => group.title);

  return (
    <aside
      className={cn(
        "hidden lg:block lg:w-72 lg:shrink-0 lg:self-start lg:sticky lg:top-[calc(var(--nav-h)+1rem)]",
        className,
      )}
    >
      <div className="glass-panel p-6 rounded-xl border border-glass-stroke flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4 pb-2 border-b border-glass-stroke">
          <p className="font-mono text-label-mono-xs uppercase text-primary font-semibold tracking-wider">
            Technical Filters
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearAll}
            className="h-7 text-label-mono-xs text-on-surface-variant hover:text-primary"
          >
            Reset
          </Button>
        </div>

        <Accordion type="multiple" defaultValue={openValues}>
          {groups.map((group) => (
            <AccordionItem key={group.title} value={group.title}>
              <AccordionTrigger className="text-body-sm font-mono uppercase tracking-wide text-on-surface">
                {group.title}
              </AccordionTrigger>
              <AccordionContent>
                <FilterGroup {...group} />
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </aside>
  );
}
