"use client";

import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CartLineItem, type CartLineItemData } from "@/components/commerce/cart-line-item";
import { formatNPR } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * MiniCartDrawer — docs/05-DESIGN-SYSTEM.md §6 component inventory: **bold**,
 * i.e. from-scratch, not present in the original Stitch exports. The small
 * slide-out cart preview typically triggered from `SiteHeader`'s cart icon.
 * Wiring that trigger up is a later integration step (a future client-side
 * cart-state provider owns `open`/`onOpenChange` and feeds `items`); this
 * component stays fully controlled and presentational, matching the "no real
 * cart/checkout state management exists yet" constraint for this batch —
 * `SiteHeader` itself is left untouched.
 *
 * `"use client"`: renders the Radix-backed `Sheet` and owns wiring
 * `onQuantityChange`/`onRemove` with each item's `productSlug` bound in
 * directly on native/`CartLineItem` elements — same class of requirement as
 * `mobile-filter-sheet.tsx` and `compare-table.tsx`.
 *
 * Empty state (§7 "Empty: Illustration + plain-language explanation + a
 * primary action") uses the shared `EmptyState` primitive rather than a
 * bespoke one-off, per its own doc comment's intent to be reused from cart
 * contexts specifically.
 *
 * Footer: the subtotal line is wrapped in `aria-live="polite"` (§5 A7 "Live
 * regions for cart updates") so a quantity change or removal is announced to
 * assistive tech via the updated total, without a separate live-region
 * element to keep in sync.
 *
 * Single CTA, not two: the spec allows either a `Button` "Go to checkout" +
 * a secondary "View cart" text link, or consolidating them — both would
 * point at the same `/cart` route (the docs/04 route map sends the mini-cart
 * to the full cart page first, not straight to `/checkout`), so two
 * near-identical links to the same destination is pure redundancy rather
 * than two real choices. One full-width primary `Button` covers it.
 */
export interface MiniCartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CartLineItemData[];
  /** Integer paisa. */
  subtotal: number;
  onQuantityChange: (productSlug: string, quantity: number) => void;
  onRemove: (productSlug: string) => void;
  className?: string;
}

export function MiniCartDrawer({
  open,
  onOpenChange,
  items,
  subtotal,
  onQuantityChange,
  onRemove,
  className,
}: MiniCartDrawerProps) {
  const isEmpty = items.length === 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className={cn("flex w-full flex-col gap-0 p-0 sm:max-w-md", className)}
      >
        <SheetHeader className="border-b border-glass-stroke px-6 py-4 text-left">
          <SheetTitle>Your cart</SheetTitle>
        </SheetHeader>

        {isEmpty ? (
          <EmptyState
            icon={<ShoppingCart aria-hidden="true" />}
            title="Your cart is empty"
            description="Browse the catalogue and add something you like."
            action={
              <Button variant="outline" asChild>
                <Link href="/shop">Continue shopping</Link>
              </Button>
            }
            className="flex-1"
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto px-6">
            <ul className="divide-y divide-glass-stroke">
              {items.map((item) => (
                <li key={item.productSlug}>
                  <CartLineItem
                    item={item}
                    onQuantityChange={(quantity) => onQuantityChange(item.productSlug, quantity)}
                    onRemove={() => onRemove(item.productSlug)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}

        {!isEmpty && (
          <div className="flex flex-col gap-3 border-t border-glass-stroke px-6 py-4">
            <div aria-live="polite" className="flex items-baseline justify-between">
              <span className="text-body-md text-on-surface">Subtotal</span>
              <span className="text-price text-on-surface">{formatNPR(subtotal)}</span>
            </div>
            <Button variant="primary" glow asChild className="w-full">
              <Link href="/cart">Go to checkout</Link>
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
