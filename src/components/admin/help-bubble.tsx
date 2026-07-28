"use client";

import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

/**
 * HelpBubble — docs/09-ADMIN-DAD-MODE.md §10 "In-product help" table:
 * "**Info bubbles** | A small `?` next to genuinely technical concepts,
 * opening a short popover with an example."
 *
 * Deliberately NOT the same thing as the table's other row, "**Field
 * helper text** | Always visible under the field. Not a tooltip —
 * tooltips are invisible on touch devices." — that's just a plain `<p>`
 * rendered under a field by the field's own caller, not a component of
 * its own, and this file doesn't build one. `HelpBubble` exists only for
 * the occasional genuinely technical term (e.g. "chipset") that doesn't
 * belong in always-visible copy, and it opens on tap/click (a Radix
 * `Popover`), so it works on touch devices where a hover-only tooltip
 * would not.
 *
 * `"use client"`: `Popover` (Radix) is interactive state.
 *
 * The trigger reuses `Button`'s existing `variant="icon" size="md"
 * iconOnly` treatment rather than a hand-rolled `<button>`, which already
 * gives the required `size-11` (44×44) hit target around a visually small
 * 16px glyph — docs/05-DESIGN-SYSTEM.md §5 A9 ("Minimum touch target
 * 44×44") plus A2 ("Every icon-only button has an aria-label").
 */
export interface HelpBubbleProps {
  label: string;
  example?: string;
  className?: string;
}

export function HelpBubble({ label, example, className }: HelpBubbleProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="icon"
          size="md"
          iconOnly
          aria-label="More information"
          className={className}
        >
          <HelpCircle className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent>
        <p className="text-body-sm text-on-surface">{label}</p>
        {example && <p className="mt-1 text-body-sm text-on-surface-variant">{example}</p>}
      </PopoverContent>
    </Popover>
  );
}
