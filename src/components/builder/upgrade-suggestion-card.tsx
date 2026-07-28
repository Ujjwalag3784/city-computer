"use client";

import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatNPR } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * UpgradeSuggestionCard — docs/08-PC-BUILDER-ENGINE.md §6 "Balance /
 * bottleneck model" example sentence: "Your processor will hold back this
 * graphics card at 1080p. Moving to a Ryzen 7 7700 (+रु 12,400) would unlock
 * roughly 15–20% more frames." This component renders exactly that shape —
 * `message` is the plain-language bottleneck sentence, `priceDeltaPaisa` is
 * the "+रु 12,400" upgrade cost, `benefitLabel` is the "roughly 15–20% more
 * frames" payoff — and is reused by the `BUILD_UPGRADE_HEADROOM` info rule
 * ("Free DIMM slots, free M.2 slots, PSU headroom — framed positively"),
 * where `message` would instead read something like "You have a free M.2
 * slot" and `benefitLabel` something like "room to add more storage later".
 *
 * Per docs/08 §1 principle 8 ("Explain in plain language" — "'This graphics
 * card is 358mm long...' Not 'GPU_LENGTH_CONSTRAINT_VIOLATION'"), `message`
 * and `benefitLabel` are always plain-language strings supplied by the
 * caller; this component never generates or interprets rule codes itself.
 *
 * The price delta is always rendered with a leading `+` (docs above) because
 * it specifically denotes an upgrade *cost*, never a savings or a generic
 * price — unlike `PriceBlock`, which renders a plain current price.
 *
 * `"use client"`: `onApply` is wired directly to a `Button`'s `onClick` in
 * this file's own render tree — the same "handler owned by this file"
 * reasoning already established by `compare-table.tsx`/`cart-line-item.tsx`/
 * `step-rail.tsx` in this codebase, regardless of whether a given render
 * happens to receive `onApply`.
 *
 * The action button reads "Consider this", not "Apply" — per docs/08 §1
 * principle 8's plain-language, customer-empowering tone, this is a
 * suggestion the shopper can weigh, not a change the system pushes through
 * on their behalf.
 */
export interface UpgradeSuggestionCardProps {
  /** Plain-language bottleneck or headroom sentence, e.g. "Your processor will hold back this graphics card at 1080p." */
  message: string;
  /** Integer paisa. Cost of the suggested upgrade — always rendered with a leading "+". */
  priceDeltaPaisa: number;
  /** Plain-language payoff, e.g. "~15–20% more frames". */
  benefitLabel?: string;
  onApply?: () => void;
  className?: string;
}

export function UpgradeSuggestionCard({
  message,
  priceDeltaPaisa,
  benefitLabel,
  onApply,
  className,
}: UpgradeSuggestionCardProps) {
  return (
    <Card variant="surface" className={cn("flex flex-col gap-3 p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-container/10 text-primary-container">
          <TrendingUp className="size-4" aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1.5">
          <p className="text-body-sm text-on-surface">{message}</p>
          <span className="text-body-md font-medium text-on-surface">
            +{formatNPR(priceDeltaPaisa)}
          </span>
          {benefitLabel && (
            <span className="text-body-sm text-primary-container">{benefitLabel}</span>
          )}
        </div>
      </div>

      {onApply && (
        <Button type="button" variant="outline" size="sm" onClick={onApply} className="self-start">
          Consider this
        </Button>
      )}
    </Card>
  );
}
