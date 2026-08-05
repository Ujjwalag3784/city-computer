"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StockAdjuster, type StockAdjustReason } from "@/components/admin/stock-adjuster";
// `enums`, not `client` — `client.ts` drags the Prisma Node runtime into the client bundle.
import { StockMovementReason } from "@/generated/prisma/enums";
import { adjustStockAction } from "../_actions";

/**
 * Wires the already-built `StockAdjuster` (Phase 2, previously only used
 * on the `/design` showcase — see that component's own doc comment) to a
 * real write for the first time: `StockAdjuster`'s five UI-string reasons
 * map onto the five `StockMovementReason` values docs/09-ADMIN-DAD-MODE.md
 * §6 actually names ("Received new stock / Sold in shop / Damaged /
 * Correction / Returned") — a variant can still separately end up with a
 * `TRANSFER_IN`/`TRANSFER_OUT`/`INITIAL`/`RESERVATION_RELEASE` movement
 * from other callers, but this screen's own dialog only ever offers the
 * five an owner would actually choose from by hand.
 */
const REASON_MAP: Record<StockAdjustReason, StockMovementReason> = {
  received: StockMovementReason.PURCHASE,
  "sold-in-shop": StockMovementReason.SALE,
  damaged: StockMovementReason.DAMAGE,
  correction: StockMovementReason.CORRECTION,
  returned: StockMovementReason.RETURN,
};

export function StockAdjusterCell({
  variantId,
  quantity,
}: {
  variantId: string;
  quantity: number;
}) {
  const router = useRouter();

  async function handleAdjust(newQuantity: number, reason: StockAdjustReason, note?: string) {
    const result = await adjustStockAction({
      variantId,
      quantity: newQuantity,
      // `reason` is `StockAdjuster`'s own closed `StockAdjustReason` union,
      // not arbitrary input — safe to index.
      // eslint-disable-next-line security/detect-object-injection
      reason: REASON_MAP[reason],
      note,
    });
    if (!result.ok) {
      toast(result.message ?? "Couldn't save the stock change. Please try again.");
      return;
    }
    router.refresh();
  }

  return <StockAdjuster quantity={quantity} onAdjust={handleAdjust} />;
}
