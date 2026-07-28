"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MoneyInput } from "@/components/admin/money-input";
import { formatNPR, paisaToRupees, rupeesToPaisa } from "@/lib/money";
import { cn } from "@/lib/utils";
import { quickUpdatePriceAction } from "../_actions";

/**
 * The product list's inline price cell — docs/09-ADMIN-DAD-MODE.md §5.2:
 * "Inline editing of price and stock directly in the row — the two
 * things edited most often." Click the price to turn the cell into two
 * `MoneyInput`s (price + offer price) with Save/Cancel; Save calls
 * `quickUpdatePriceAction` directly (this file lives under `app/`, so it
 * can import a Server Action without going through a components/ boundary
 * prop, unlike `admin-topbar.tsx`'s search).
 *
 * docs/09 §8's "warn if the new price differs from the old by more than
 * 50%" surfaces here as a plain `toast`, after the save has already
 * happened — `quickUpdatePrice`'s own doc comment: "a non-blocking
 * heads-up, not a rejected save."
 */
export interface InlinePriceCellProps {
  variantId: string;
  pricePaisa: number;
  compareAtPricePaisa: number | null;
  canEditPrice: boolean;
}

export function InlinePriceCell({
  variantId,
  pricePaisa,
  compareAtPricePaisa,
  canEditPrice,
}: InlinePriceCellProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [price, setPrice] = useState<number | "">(paisaToRupees(pricePaisa));
  const [compareAt, setCompareAt] = useState<number | "">(
    compareAtPricePaisa !== null ? paisaToRupees(compareAtPricePaisa) : "",
  );
  const [isPending, startTransition] = useTransition();

  if (!canEditPrice) {
    return (
      <div className="flex flex-col items-end">
        <span>{formatNPR(pricePaisa)}</span>
        {compareAtPricePaisa !== null && (
          <span className="text-body-sm text-on-surface-variant line-through">
            {formatNPR(compareAtPricePaisa)}
          </span>
        )}
      </div>
    );
  }

  if (!isEditing) {
    return (
      <button
        type="button"
        onClick={() => setIsEditing(true)}
        className={cn(
          "flex flex-col items-end rounded px-1 text-right transition-colors hover:bg-surface-container-high",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container",
        )}
      >
        <span>{formatNPR(pricePaisa)}</span>
        {compareAtPricePaisa !== null && (
          <span className="text-body-sm text-on-surface-variant line-through">
            {formatNPR(compareAtPricePaisa)}
          </span>
        )}
      </button>
    );
  }

  function handleSave() {
    if (price === "" || price <= 0) {
      toast("Enter a price.");
      return;
    }
    startTransition(async () => {
      const result = await quickUpdatePriceAction({
        variantId,
        pricePaisa: rupeesToPaisa(price),
        compareAtPricePaisa: compareAt === "" ? undefined : rupeesToPaisa(compareAt),
      });
      if (!result.ok) {
        toast(result.message ?? "Couldn't save the price. Please try again.");
        return;
      }
      if (result.data?.warning) toast(result.data.warning);
      setIsEditing(false);
      router.refresh();
    });
  }

  return (
    <div className="flex w-40 flex-col gap-2">
      <MoneyInput value={price} onChange={setPrice} aria-label="Price" />
      <MoneyInput
        value={compareAt}
        onChange={setCompareAt}
        placeholder="Offer price"
        aria-label="Offer price"
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
