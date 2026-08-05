"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
// `enums`, not `client` — `client.ts` drags the Prisma Node runtime into the client bundle.
import { StockMovementReason } from "@/generated/prisma/enums";
import { bulkAdjustStockAction } from "../_actions";

export interface BulkStockRow {
  variantId: string;
  productName: string;
  quantity: number;
}

/**
 * docs/09-ADMIN-DAD-MODE.md §6 "Bulk update": "a dedicated screen: search
 * or scan, then a list of rows with quantity inputs, one 'Save all' at
 * the bottom, and a confirmation summarising the changes ('You're about
 * to change stock for 14 products. 3 will go to zero.')." Built as a
 * dialog over the inventory list's own search/selection rather than a
 * separate route — the list already IS the "search or scan" step, so a
 * second full screen for "then a list of rows" would just repeat it.
 *
 * One reason/note for the whole batch — see `validation/admin/inventory.ts`'s
 * `bulkStockAdjustSchema` doc comment for why that's a deliberate
 * simplification, not an oversight.
 */
const REASON_OPTIONS: { value: StockMovementReason; label: string }[] = [
  { value: StockMovementReason.PURCHASE, label: "Received new stock" },
  { value: StockMovementReason.SALE, label: "Sold in shop" },
  { value: StockMovementReason.DAMAGE, label: "Damaged" },
  { value: StockMovementReason.CORRECTION, label: "Correction" },
  { value: StockMovementReason.RETURN, label: "Returned" },
];

export function BulkStockDialog({
  open,
  onOpenChange,
  rows,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: BulkStockRow[];
}) {
  const router = useRouter();
  const [step, setStep] = useState<"edit" | "confirm">("edit");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<StockMovementReason | undefined>(undefined);
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep("edit");
    setQuantities(Object.fromEntries(rows.map((row) => [row.variantId, row.quantity])));
    setReason(undefined);
    setNote("");
  }, [open, rows]);

  const changedRows = rows.filter(
    (row) => (quantities[row.variantId] ?? row.quantity) !== row.quantity,
  );
  const zeroingCount = changedRows.filter(
    (row) => (quantities[row.variantId] ?? row.quantity) === 0,
  ).length;

  async function handleConfirm() {
    if (!reason) return;
    setIsSubmitting(true);
    try {
      const result = await bulkAdjustStockAction({
        items: changedRows.map((row) => ({
          variantId: row.variantId,
          quantity: quantities[row.variantId]!,
        })),
        reason,
        note: note.trim() ? note.trim() : undefined,
      });
      if (!result.ok || !result.data) {
        toast(result.message ?? "Couldn't save those changes. Please try again.");
        return;
      }
      if (result.data.failedVariantIds.length > 0) {
        toast(
          `Saved ${result.data.updatedCount} of ${changedRows.length}. ${result.data.failedVariantIds.length} couldn't be updated — they may have been removed.`,
        );
      } else {
        toast(
          `Updated stock for ${result.data.updatedCount} product${result.data.updatedCount === 1 ? "" : "s"}.`,
        );
      }
      onOpenChange(false);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Update stock for {rows.length} products</DialogTitle>
        </DialogHeader>

        {step === "edit" && (
          <div className="flex flex-col gap-4">
            <ul className="flex max-h-72 flex-col gap-3 overflow-y-auto">
              {rows.map((row) => (
                <li key={row.variantId} className="flex items-center justify-between gap-4">
                  <Label htmlFor={`bulk-qty-${row.variantId}`} className="flex-1 truncate">
                    {row.productName}
                  </Label>
                  <Input
                    id={`bulk-qty-${row.variantId}`}
                    type="number"
                    min={0}
                    className="w-24"
                    value={quantities[row.variantId] ?? row.quantity}
                    onChange={(event) =>
                      setQuantities((current) => ({
                        ...current,
                        [row.variantId]: Math.max(0, Number(event.target.value)),
                      }))
                    }
                  />
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-1.5">
              <span className="text-body-sm text-on-surface-variant">Reason (required)</span>
              <RadioGroup
                value={reason}
                onValueChange={(value) => setReason(value as StockMovementReason)}
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
              <Label htmlFor="bulk-note">Note (optional)</Label>
              <Textarea
                id="bulk-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        {step === "confirm" && (
          <p className="text-body-md text-on-surface">
            You&rsquo;re about to change stock for {changedRows.length} product
            {changedRows.length === 1 ? "" : "s"}.
            {zeroingCount > 0 && ` ${zeroingCount} will go to zero.`}
          </p>
        )}

        <DialogFooter>
          {step === "edit" ? (
            <>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!reason || changedRows.length === 0}
                onClick={() => setStep("confirm")}
              >
                Review changes
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("edit")}
                disabled={isSubmitting}
              >
                Back
              </Button>
              <Button type="button" onClick={handleConfirm} disabled={isSubmitting}>
                {isSubmitting ? "Saving…" : "Save all"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
