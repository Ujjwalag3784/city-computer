"use client";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PartRow, type PartRowData } from "@/components/builder/part-row";
import { cn } from "@/lib/utils";

/**
 * FixDrawer — docs/08-PC-BUILDER-ENGINE.md §9 "Issue presentation": "each row
 * expandable into a Fix drawer listing candidate parts with price deltas."
 *
 * `IssueRow` (built separately) is what triggers this drawer via its own
 * `onFix` callback, but this component has no import of / knowledge about
 * `IssueRow` — the two are decoupled through whatever page/state owns both,
 * matching `issue-row.tsx`'s own note that it "doesn't render or import the
 * Fix drawer itself."
 *
 * `issueMessage` is rendered verbatim below the title, via `SheetDescription`
 * (wiring Radix's `aria-describedby` automatically) — per §9's copy rule
 * ("Copy is plain language. Never a rule code, never a spec key, never
 * 'constraint violation'"), this text is assumed to already be the
 * plain-language string produced upstream; this component neither formats
 * nor translates it.
 *
 * Each `candidates` row is rendered via the shared `PartRow`, expected to
 * carry `priceDeltaPaisa` so the row renders a signed delta (`+रु 4,500` /
 * `-रु 1,200`) instead of a plain price — that delta is computed upstream
 * (vs. whichever part is currently in the affected slot), never here.
 *
 * Built on `Sheet`/`SheetContent side="right"`, widened the same way
 * `PartPickerDrawer` is, for the same reason (room for thumbnail + specs +
 * delta price).
 *
 * `"use client"` — renders `PartRow`s with `onSelect` handlers wired to
 * `onSelectCandidate`, the same Server/Client-boundary reasoning already
 * established across this directory's other drawer/row components.
 */
export interface FixDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Plain-language issue text, shown verbatim — never a rule code (§9). */
  issueMessage: string;
  /** Candidate replacement parts, expected to carry `priceDeltaPaisa`. */
  candidates: PartRowData[];
  onSelectCandidate: (part: PartRowData) => void;
  className?: string;
}

export function FixDrawer({
  open,
  onOpenChange,
  issueMessage,
  candidates,
  onSelectCandidate,
  className,
}: FixDrawerProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className={cn("w-full gap-4 sm:max-w-lg", className)}>
        <SheetHeader>
          <SheetTitle>Fix this issue</SheetTitle>
          <SheetDescription>{issueMessage}</SheetDescription>
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
          {candidates.length === 0 ? (
            <p className="py-8 text-center text-body-sm text-on-surface-variant">
              No alternative parts are available right now.
            </p>
          ) : (
            candidates.map((candidate) => (
              <PartRow
                key={candidate.id}
                part={candidate}
                onSelect={() => onSelectCandidate(candidate)}
              />
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
