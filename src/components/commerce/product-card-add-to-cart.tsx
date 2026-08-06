"use client";

import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { addToCartAction } from "@/app/[locale]/(storefront)/_actions";
import { useCartStore } from "@/stores/cart-store";

/**
 * ProductCardAddToCart — the client-side owner of a product card's
 * add-to-cart handler.
 *
 * WHY THIS FILE EXISTS. `AddToCartButton` is a Client Component and
 * `onAddToCart` is a function. `ProductCard`, which renders it, is a plain
 * presentational module with no `"use client"` of its own, so on the
 * storefront routes that render a card from a Server Component (`/`,
 * `/p/[productSlug]`'s related rail, `/blog/[slug]`'s related rail) the
 * card was a *Server* Component handing a function across the
 * server→client boundary. React cannot serialise a function into the RSC
 * payload, so every one of those routes threw:
 *
 *     Error: Event handlers cannot be passed to Client Component props.
 *       {onAddToCart: function onAddToCart, outOfStock: …, className: …}
 *
 * and returned HTTP 500. The fix is not to make the page (or the card) a
 * Client Component — it is for the interactive leaf to own its own
 * handler, so nothing but serialisable data (`variantId`, `outOfStock`,
 * `className`) ever crosses the boundary. That makes `ProductCard` safe to
 * render from either side without the caller having to know which it is.
 *
 * This mirrors `cart-drawer-host.tsx` exactly — the established pattern in
 * this directory for "a `"use client"` host that turns a presentational
 * component's callbacks into real Server Action calls", including the same
 * "replace the store's view with the action's own freshly re-resolved
 * `CartView` rather than computing it locally" rule.
 *
 * JUDGMENT CALL — which variant a card adds. `ProductCardData.variantId` is
 * the *cheapest active* variant, the same row the card's "from" price is
 * derived from (`catalog/product.ts`'s `getMinPriceVariantsByProduct`), so
 * a quick-add always adds exactly the item whose price the shopper just
 * read. Picking options for a multi-variant product still belongs on the
 * PDP, which is one click away through the card's own `Link`.
 *
 * When `variantId` is absent — a product with no active variant row at all
 * (`toProductSummary` logs a warning for that case), or a demo card on the
 * `/design` showcase — the button still renders so the card's layout is
 * unchanged, and a click surfaces `AddToCartButton`'s own error state
 * rather than silently doing nothing.
 */
export interface ProductCardAddToCartProps {
  /** The variant a quick-add should add. Absent for a product with no active variant. */
  variantId?: string;
  outOfStock?: boolean;
  className?: string;
}

export function ProductCardAddToCart({
  variantId,
  outOfStock = false,
  className,
}: ProductCardAddToCartProps) {
  const setCartView = useCartStore((state) => state.setView);
  const openCartDrawer = useCartStore((state) => state.openDrawer);

  async function handleAddToCart() {
    if (!variantId) {
      // Thrown, not swallowed: `AddToCartButton` catches this itself and
      // shows its "Couldn't add — try again" rollback state, which is the
      // honest outcome for a card that has nothing addable behind it.
      throw new Error("This product has no purchasable option yet.");
    }
    const result = await addToCartAction({ variantId, quantity: 1 });
    if (!result.ok || !result.data) {
      throw new Error(result.message ?? "Couldn't add to cart");
    }
    setCartView(result.data);
    openCartDrawer();
  }

  return (
    <AddToCartButton onAddToCart={handleAddToCart} outOfStock={outOfStock} className={className} />
  );
}
