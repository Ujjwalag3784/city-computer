"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { MiniCartDrawer } from "@/components/commerce/mini-cart-drawer";
import type { CartLineItemData } from "@/components/commerce/cart-line-item";
import { useCartStore, type CartView } from "@/stores/cart-store";
import {
  getCartAction,
  removeCartItemAction,
  updateCartItemAction,
} from "@/app/[locale]/(storefront)/_actions";

/**
 * Mounted exactly once, in the storefront root layout — the piece the
 * layout's own doc comment (before docs/17 Phase 6 landed) flagged as
 * missing: "`CartDrawer` is deliberately not rendered here yet... flagged
 * rather than faked." This is that wiring: it hydrates `cart-store.ts` on
 * mount, renders the presentational `MiniCartDrawer` bound to the store's
 * `isDrawerOpen`, and turns its `onQuantityChange`/`onRemove` callbacks
 * into real Server Action calls — each one replaces the store's `view`
 * with the Server Action's own freshly re-resolved `CartView` rather than
 * computing the new state locally, so a price/stock warning that appears
 * as a side effect of the shopper's own edit is never missed.
 */
/** A 1x1 transparent pixel — this codebase has no placeholder-image asset yet (checked: no `public/` image fallback exists), and a product genuinely missing every media row is meant to be an unreachable edge case (docs/09 §5's product wizard requires at least one photo before publish), not one worth inventing a new asset file for. */
const BLANK_IMAGE_DATA_URL =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBTAA7";

function toLineItems(view: CartView): CartLineItemData[] {
  return view.items.map((item) => ({
    variantId: item.variantId,
    productSlug: item.productSlug,
    imageUrl: item.imageUrl ?? BLANK_IMAGE_DATA_URL,
    imageAlt: item.imageAlt,
    displayTitle: item.productName,
    variantLabel: item.variantLabel ?? undefined,
    unitPrice: item.unitPricePaisa,
    quantity: item.quantity,
    maxQuantity: item.availableQuantity > 0 ? item.availableQuantity : undefined,
    isOutOfStock: item.isOutOfStock,
  }));
}

export function CartDrawerHost() {
  const view = useCartStore((state) => state.view);
  const isDrawerOpen = useCartStore((state) => state.isDrawerOpen);
  const setDrawerOpen = useCartStore((state) => state.setDrawerOpen);
  const setView = useCartStore((state) => state.setView);

  useEffect(() => {
    getCartAction().then((result) => {
      if (result.ok && result.data) setView(result.data);
    });
  }, [setView]);

  async function handleQuantityChange(variantId: string, quantity: number) {
    const result = await updateCartItemAction({ variantId, quantity });
    if (result.ok && result.data) {
      setView(result.data);
    } else {
      toast(result.message ?? "Couldn't update that item. Please try again.");
    }
  }

  async function handleRemove(variantId: string) {
    const result = await removeCartItemAction({ variantId });
    if (result.ok && result.data) {
      setView(result.data);
    } else {
      toast(result.message ?? "Couldn't remove that item. Please try again.");
    }
  }

  return (
    <MiniCartDrawer
      open={isDrawerOpen}
      onOpenChange={setDrawerOpen}
      items={view ? toLineItems(view) : []}
      subtotal={view?.subtotalPaisa ?? 0}
      onQuantityChange={handleQuantityChange}
      onRemove={handleRemove}
    />
  );
}
