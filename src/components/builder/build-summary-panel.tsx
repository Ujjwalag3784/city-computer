"use client";

import type { ComponentProps } from "react";
import { Check, FileText, Loader2, ShoppingCart, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatNPR } from "@/lib/money";
import { cn } from "@/lib/utils";
import { UpgradeSuggestionCard } from "./upgrade-suggestion-card";

/**
 * BuildSummaryPanel — docs/05-DESIGN-SYSTEM.md §8 Builder page layout:
 * "`lg:` [2-col step rail ‖ 7-col slot workspace ‖ 3-col sticky summary].
 * `<lg:` [... sticky bottom summary bar that expands to a sheet]". This
 * component is the "3-col sticky summary" content on desktop *and* the
 * content of the mobile bottom sheet — like `order-summary-panel.tsx`
 * (`src/components/commerce/`), sticky/fixed positioning is deliberately NOT
 * baked in here; the `/build` page decides whether it's anchored in a
 * sidebar or slid up in a sheet, via `className`.
 *
 * Action set is exactly docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md §4.2's Step 10
 * "Review" journey: "Save (autosaved already) ──► `/build/a7Kd93Xq`
 * (shareable; noindex by default) ├─► Print / PDF quotation └─► Add all to
 * cart ──► `/checkout`". Because saving is already automatic, there is
 * deliberately NO manual "Save" button anywhere in this component —
 * `autosaveStatus` only ever *reports* the autosave state, it never
 * triggers one. `onShare` is what the page wires to open the sibling
 * `BuildShareDialog` (the dialog that actually surfaces the `/build/a7Kd93Xq`
 * link) — this component only renders the "Share" button, it doesn't
 * import or render that dialog itself, keeping the two composable
 * independently. `onPrintPdf` is likewise just a callback; no PDF-generation
 * logic exists yet in this codebase (later phase).
 *
 * Per docs/08-PC-BUILDER-ENGINE.md §2 "Slot model": "Completeness = all
 * required slots filled AND zero ERROR-severity issues. Only a complete
 * build may be added to cart." — "Add all to cart" is `disabled` (never
 * hidden) whenever `!isComplete`, and `incompleteReason` renders directly
 * below it so a disabled button is never left unexplained.
 *
 * `upgradeSuggestions`, when given, renders each entry through the sibling
 * `UpgradeSuggestionCard` (docs/08 §6's bottleneck/headroom shape) in a
 * small stack between the header and the action row.
 *
 * `"use client"`: `onShare`/`onPrintPdf`/`onAddToCart` are all wired
 * directly to `Button`s' `onClick` in this file's own render tree — the
 * same "handler owned by this file" reasoning already established by
 * `compare-table.tsx`/`cart-line-item.tsx`/`step-rail.tsx` in this codebase.
 */
export interface BuildSummaryPanelProps {
  /** Integer paisa. */
  totalPrice: number;
  isComplete: boolean;
  /** Shown directly below the disabled "Add all to cart" button when `!isComplete`, e.g. "Pick a power supply to continue." */
  incompleteReason?: string;
  autosaveStatus?: "saved" | "saving" | "unsaved";
  upgradeSuggestions?: ComponentProps<typeof UpgradeSuggestionCard>[];
  onShare: () => void;
  onPrintPdf: () => void;
  onAddToCart: () => void;
  className?: string;
}

const AUTOSAVE_LABEL: Record<NonNullable<BuildSummaryPanelProps["autosaveStatus"]>, string> = {
  saved: "Saved",
  saving: "Saving…",
  unsaved: "Unsaved changes",
};

function AutosaveIndicator({
  status,
}: {
  status: NonNullable<BuildSummaryPanelProps["autosaveStatus"]>;
}) {
  return (
    <span className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
      {status === "saved" && <Check className="size-4 text-success" aria-hidden="true" />}
      {status === "saving" && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
      {/* `status` is the closed autosave-status union, not arbitrary input. */}
      {/* eslint-disable-next-line security/detect-object-injection */}
      {AUTOSAVE_LABEL[status]}
    </span>
  );
}

export function BuildSummaryPanel({
  totalPrice,
  isComplete,
  incompleteReason,
  autosaveStatus,
  upgradeSuggestions,
  onShare,
  onPrintPdf,
  onAddToCart,
  className,
}: BuildSummaryPanelProps) {
  const hasSuggestions = Boolean(upgradeSuggestions && upgradeSuggestions.length > 0);

  return (
    <Card variant="glass" className={cn("flex flex-col", className)}>
      <CardHeader className="flex flex-row items-baseline justify-between gap-2">
        <span className="text-price-lg text-on-surface">{formatNPR(totalPrice)}</span>
        {autosaveStatus && <AutosaveIndicator status={autosaveStatus} />}
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {hasSuggestions && (
          <div className="flex flex-col gap-2">
            {upgradeSuggestions?.map((suggestion, index) => (
              // Suggestions are caller-ordered presentational props with no
              // stable id of their own (per the shared prop type above) —
              // index is a reasonable list key here since the whole list is
              // replaced wholesale by the caller rather than reordered in place.
              <UpgradeSuggestionCard key={index} {...suggestion} />
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onShare}>
            <Share2 aria-hidden="true" />
            Share
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={onPrintPdf}>
            <FileText aria-hidden="true" />
            Print / PDF
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Button
            type="button"
            variant="primary"
            glow
            disabled={!isComplete}
            onClick={onAddToCart}
            className="w-full"
          >
            <ShoppingCart aria-hidden="true" />
            Add all to cart
          </Button>
          {!isComplete && incompleteReason && (
            <p className="text-body-sm text-on-surface-variant">{incompleteReason}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
