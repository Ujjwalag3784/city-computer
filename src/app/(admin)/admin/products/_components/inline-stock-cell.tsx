"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StockLevelBar } from "@/components/admin/stock-level-bar";
import { quickUpdateStockAction } from "../_actions";

/**
 * The product list's inline stock cell — docs/09-ADMIN-DAD-MODE.md §5.2's
 * other "edited most often" inline field, paired with `InlinePriceCell`.
 * Click the bar to reveal a plain number input; Save writes via
 * `quickUpdateStockAction`, which (via `adjustVariantStock`) always
 * records a `StockMovement` with `reason: "CORRECTION"` — see that
 * schema's own doc comment for why a bare table cell can't offer §6's
 * full "Set..." dialog with a reason picker.
 */
export interface InlineStockCellProps {
  variantId: string;
  quantity: number;
  canEditStock: boolean;
}

export function InlineStockCell({ variantId, quantity, canEditStock }: InlineStockCellProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState<number | "">(quantity);
  const [isPending, startTransition] = useTransition();

  if (!canEditStock) {
    return <StockLevelBar quantity={quantity} className="w-36" />;
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className="w-36 rounded text-left transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container"
      >
        <StockLevelBar quantity={quantity} />
      </button>
    );
  }

  function handleSave() {
    if (value === "") {
      toast("Enter how many you have.");
      return;
    }
    startTransition(async () => {
      const result = await quickUpdateStockAction({ variantId, quantity: value });
      if (!result.ok) {
        toast(result.message ?? "Couldn't save the stock number. Please try again.");
        return;
      }
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="flex w-36 flex-col gap-2">
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(event) =>
          setValue(event.target.value === "" ? "" : Math.max(0, Number(event.target.value)))
        }
        aria-label="Stock"
      />
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setIsEditing(false)}
          disabled={isPending}
        >
          Cancel
        </Button>
        <Button type="button" size="sm" onClick={handleSave} disabled={isPending}>
          {isPending ? "Saving…" : "Save"}
        </Button>
      </div>
    </div>
  );
}
