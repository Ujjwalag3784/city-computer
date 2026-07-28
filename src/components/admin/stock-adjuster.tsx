"use client";

import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * StockAdjuster — docs/09-ADMIN-DAD-MODE.md §6 "Stock management" → "Quick
 * actions": "Every stock number in the system has inline −1 / +1 / Set…
 * controls. Set… opens a small dialog: new quantity, a required reason
 * (Received new stock / Sold in shop / Damaged / Correction / Returned),
 * and an optional note." "Every change writes a `StockMovement`. There is
 * no way to change stock without a recorded reason."
 *
 * That last sentence is absolute and carries no carve-out for the quick
 * −1/+1 buttons, so this component never calls `onAdjust` directly from
 * them — clicking −1 or +1 opens the exact same reason-collecting dialog
 * as "Set…", just pre-filled with `quantity - 1` / `quantity + 1` (clamped
 * to 0) instead of the current quantity. The confirm button stays disabled
 * until a reason is picked, which is what actually enforces "required"
 * rather than just implying it.
 *
 * The −1/+1 buttons use `Button size="lg" iconOnly`, which resolves to
 * `size-12` (48×48) via the shared `buttonVariants` compound variants —
 * the admin-specific touch target floor in docs/09 §11 ("Touch targets
 * 48×48 CSS px minimum") — rather than hardcoding `size-12` here directly.
 */

export type StockAdjustReason = "received" | "sold-in-shop" | "damaged" | "correction" | "returned";

const REASON_OPTIONS: { value: StockAdjustReason; label: string }[] = [
  { value: "received", label: "Received new stock" },
  { value: "sold-in-shop", label: "Sold in shop" },
  { value: "damaged", label: "Damaged" },
  { value: "correction", label: "Correction" },
  { value: "returned", label: "Returned" },
];

export interface StockAdjusterProps {
  quantity: number;
  onAdjust: (newQuantity: number, reason: StockAdjustReason, note?: string) => void | Promise<void>;
  className?: string;
}

export function StockAdjuster({ quantity, onAdjust, className }: StockAdjusterProps) {
  const [open, setOpen] = React.useState(false);
  const [pendingQuantity, setPendingQuantity] = React.useState(quantity);
  const [reason, setReason] = React.useState<StockAdjustReason | undefined>(undefined);
  const [note, setNote] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const openDialogAt = (nextQuantity: number) => {
    setPendingQuantity(nextQuantity);
    setReason(undefined);
    setNote("");
    setOpen(true);
  };

  const handleOpenChange = (next: boolean) => {
    if (!isSubmitting) setOpen(next);
  };

  const handleConfirm = async () => {
    if (!reason || Number.isNaN(pendingQuantity)) return;
    setIsSubmitting(true);
    try {
      await onAdjust(pendingQuantity, reason, note.trim() ? note.trim() : undefined);
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Button
        type="button"
        variant="outline"
        size="lg"
        iconOnly
        aria-label="Decrease by 1"
        onClick={() => openDialogAt(Math.max(0, quantity - 1))}
      >
        <Minus className="size-4" />
      </Button>

      <span
        className="min-w-10 text-center text-body-lg font-medium text-on-surface"
        aria-live="polite"
      >
        {quantity}
      </span>

      <Button
        type="button"
        variant="outline"
        size="lg"
        iconOnly
        aria-label="Increase by 1"
        onClick={() => openDialogAt(quantity + 1)}
      >
        <Plus className="size-4" />
      </Button>

      <Button type="button" variant="outline" size="sm" onClick={() => openDialogAt(quantity)}>
        Set…
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              Every stock change needs a reason. This keeps the record straight for everyone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label
                htmlFor="stock-adjuster-quantity"
                className="text-body-sm text-on-surface-variant"
              >
                New quantity
              </label>
              <Input
                id="stock-adjuster-quantity"
                type="number"
                min={0}
                value={pendingQuantity}
                onChange={(event) => setPendingQuantity(Number(event.target.value))}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-body-sm text-on-surface-variant">Reason (required)</span>
              <RadioGroup
                value={reason}
                onValueChange={(value) => setReason(value as StockAdjustReason)}
              >
                {REASON_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className="flex min-h-9 items-center gap-2 text-body-md text-on-surface"
                  >
                    <RadioGroupItem value={option.value} />
                    {option.label}
                  </label>
                ))}
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="stock-adjuster-note" className="text-body-sm text-on-surface-variant">
                Note (optional)
              </label>
              <Textarea
                id="stock-adjuster-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!reason || isSubmitting || Number.isNaN(pendingQuantity)}
            >
              {isSubmitting ? "Saving…" : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
