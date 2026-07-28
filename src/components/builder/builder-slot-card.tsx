"use client";

import Image from "next/image";
import { Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { PriceBlock } from "@/components/commerce/price-block";
import type { PartRowData } from "@/components/builder/part-row";
import { cn } from "@/lib/utils";

/**
 * BuilderSlotCard — docs/08-PC-BUILDER-ENGINE.md §2 "Slot model" (each slot —
 * `cpu`, `motherboard`, `ram`, `gpu`, `storage_1..4`, `psu`, `case`,
 * `cpu_cooler`, `case_fan_1..6`, `monitor_1..3`, `os`, `expansion_1..3`,
 * `peripherals`, `thermal_paste` — is required, conditional, or optional) and
 * §9 "Prevention affordances" ("a slot blocked by a missing prerequisite
 * shows 'Pick a processor first' rather than an empty list"). This is the
 * per-slot tile a builder workspace grid renders one of per slot; it never
 * fetches or decides slot state itself — `state` is computed upstream by the
 * rules engine and handed in as a prop.
 *
 * `"use client"` — the "Change"/"Choose"/"Add (optional)" buttons and the
 * remove icon-button all attach `onClick` directly to native `<button>`s in
 * this file's own render tree (via `Button`), the same convention already
 * established by `issue-row.tsx`/`step-rail.tsx`/`cart-line-item.tsx`.
 *
 * State -> shape mapping:
 * - `filled` — condensed selected-part display (thumbnail + name +
 *   `PriceBlock`; deliberately denser than `PartRow`, not a reuse of it,
 *   since a filled slot tile has far less room than a picker row) plus a
 *   "Change" button and, if `onRemove` is supplied, a small `X` icon-button
 *   to clear the slot.
 * - `empty-required` — dashed empty card, "Pick a {slotLabel}" prompt, a
 *   primary "Choose" button, and a `border-warning/40` dashed border (never
 *   `border-danger` — per §2 an empty required slot blocks checkout, which
 *   is worth a firmer border tone than an optional slot, but §9's "prevent,
 *   don't scold" principle rules out an alarming red on a step the shopper
 *   simply hasn't reached yet).
 * - `empty-optional` — same shape, calmer: `border-glass-stroke` dashed,
 *   `text-on-surface-variant` prompt, `Button variant="outline"` "Add
 *   (optional)".
 * - `incompatible` — per §9's missing-prerequisite affordance: "Pick a
 *   {prerequisiteLabel} first", with no `onPick` button rendered at all
 *   (there is nothing to pick yet until the prerequisite slot is filled).
 * - `recommended` — the `empty-optional` shape plus a small "Recommended"
 *   `Badge` with a `Sparkles` icon and a thin `primary-container` top
 *   border, for optional slots the rules engine thinks worth considering
 *   without making them a hard requirement.
 *
 * Every button here meets the §5 A9 44×44 touch target via `Button`'s own
 * `size="sm"`/icon-only sizing conventions.
 */
export type BuilderSlotState =
  | "filled"
  | "empty-required"
  | "empty-optional"
  | "incompatible"
  | "recommended";

export interface BuilderSlotCardProps {
  slotLabel: string;
  state: BuilderSlotState;
  part?: PartRowData;
  /** The slot label of the missing prerequisite — only used when `state === "incompatible"`. */
  prerequisiteLabel?: string;
  onPick: () => void;
  onRemove?: () => void;
  className?: string;
}

function EmptySlotBody({
  slotLabel,
  tone,
  buttonVariant,
  buttonLabel,
  onPick,
}: {
  slotLabel: string;
  tone: "required" | "optional";
  buttonVariant: "primary" | "outline";
  buttonLabel: string;
  onPick: () => void;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border-2 border-dashed p-6 text-center",
        tone === "required" ? "border-warning/40" : "border-glass-stroke",
      )}
    >
      <p
        className={cn(
          "text-body-sm",
          tone === "required" ? "text-on-surface" : "text-on-surface-variant",
        )}
      >
        Pick a {slotLabel}
      </p>
      <Button variant={buttonVariant} size="sm" onClick={onPick}>
        {buttonLabel}
      </Button>
    </div>
  );
}

export function BuilderSlotCard({
  slotLabel,
  state,
  part,
  prerequisiteLabel,
  onPick,
  onRemove,
  className,
}: BuilderSlotCardProps) {
  const isRecommended = state === "recommended";

  return (
    <Card borderTone={isRecommended ? "primary" : "default"} className={cn(className)}>
      <CardHeader className="flex-row items-center justify-between gap-2 pb-0">
        <span className="text-label-mono-xs text-on-surface-variant">{slotLabel}</span>
        {isRecommended && (
          <Badge variant="primary">
            <Sparkles className="size-3" aria-hidden="true" />
            Recommended
          </Badge>
        )}
      </CardHeader>

      <CardContent>
        {state === "filled" && part && (
          <div className="flex items-center gap-3">
            <div className="relative size-12 shrink-0 overflow-hidden rounded bg-surface-container-high">
              <Image
                src={part.imageUrl}
                alt={part.imageAlt}
                fill
                sizes="48px"
                className="object-contain"
              />
            </div>
            <div className="flex flex-1 flex-col gap-0.5 overflow-hidden">
              <span className="line-clamp-1 text-body-sm font-medium text-on-surface">
                {part.name}
              </span>
              <PriceBlock price={part.price} compareAtPrice={part.compareAtPrice} size="sm" />
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button variant="outline" size="sm" onClick={onPick}>
                Change
              </Button>
              {onRemove && (
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  onClick={onRemove}
                  aria-label={`Remove ${part.name} from ${slotLabel}`}
                >
                  <X aria-hidden="true" />
                </Button>
              )}
            </div>
          </div>
        )}

        {state === "empty-required" && (
          <EmptySlotBody
            slotLabel={slotLabel}
            tone="required"
            buttonVariant="primary"
            buttonLabel="Choose"
            onPick={onPick}
          />
        )}

        {(state === "empty-optional" || state === "recommended") && (
          <EmptySlotBody
            slotLabel={slotLabel}
            tone="optional"
            buttonVariant="outline"
            buttonLabel="Add (optional)"
            onPick={onPick}
          />
        )}

        {state === "incompatible" && (
          <div className="flex flex-col items-center gap-1 rounded-lg border-2 border-dashed border-glass-stroke p-6 text-center">
            <p className="text-body-sm text-on-surface-variant">
              Pick a {prerequisiteLabel ?? "prerequisite part"} first
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
