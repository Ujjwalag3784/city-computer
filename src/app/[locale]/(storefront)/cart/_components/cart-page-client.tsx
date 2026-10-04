"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Banknote, FileText, ShoppingCart, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CartLineItem, type CartLineItemData } from "@/components/commerce/cart-line-item";
import { OrderSummaryPanel } from "@/components/commerce/order-summary-panel";
import { useCartStore } from "@/stores/cart-store";
import {
  applyCouponAction,
  removeCartItemAction,
  updateCartItemAction,
} from "@/app/[locale]/(storefront)/_actions";
import type { CartView } from "@/server/services/commerce/cart";
import type { CouponPreview } from "@/server/services/commerce/coupon";

function toLineItems(view: CartView): CartLineItemData[] {
  return view.items.map((item) => ({
    variantId: item.variantId,
    productSlug: item.productSlug,
    imageUrl: item.imageUrl ?? undefined,
    imageAlt: item.imageAlt,
    displayTitle: item.productName,
    variantLabel: item.variantLabel ?? undefined,
    unitPrice: item.unitPricePaisa,
    quantity: item.quantity,
    maxQuantity: item.availableQuantity > 0 ? item.availableQuantity : undefined,
    isOutOfStock: item.isOutOfStock,
  }));
}

/** Only what checkout really offers (COD, bank transfer, branch pickup, PDF invoice). */
const CART_ASSURANCES = [
  { icon: Banknote, label: "Cash on delivery or bank transfer" },
  { icon: Store, label: "Free pickup from our New Road showroom" },
  { icon: FileText, label: "PDF invoice with every order" },
];

export interface CartPageClientProps {
  initialView: CartView;
  initialCoupon: CouponPreview | null;
}

/**
 * The full `/cart` page's interactive half — docs/05 §8's 8/4 split (line
 * items list ‖ sticky `OrderSummaryPanel`), both already-built components
 * reused as-is, not re-implemented. Every mutation goes through the same
 * Server Actions `cart-drawer-host.tsx` uses and writes the result back to
 * the same `stores/cart-store.ts`, so editing quantity here and then
 * opening the header's mini-cart shows the identical, already-fresh state
 * — there is exactly one client-side cache for cart data, not two drifting
 * copies.
 */
export function CartPageClient({ initialView, initialCoupon }: CartPageClientProps) {
  const view = useCartStore((state) => state.view) ?? initialView;
  const setView = useCartStore((state) => state.setView);
  const [coupon, setCoupon] = useState<CouponPreview | null>(initialCoupon);

  useEffect(() => {
    setView(initialView);
    // Only on first mount — the store should win over `initialView` for
    // every render after that, once a mutation has updated it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handleApplyCoupon(code: string) {
    const result = await applyCouponAction({ code });
    if (result.ok && result.data) {
      setView(result.data.cart);
      setCoupon(result.data.coupon);
      if (code !== "" && !result.data.coupon) {
        toast("That coupon couldn't be applied.");
      }
    } else {
      toast(result.message ?? "Couldn't apply that coupon.");
    }
  }

  if (view.items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart aria-hidden="true" />}
        title="Your cart is empty"
        description="Browse the catalogue and add something you like."
        action={
          <Button variant="outline" asChild>
            <Link href="/shop">Continue shopping</Link>
          </Button>
        }
      />
    );
  }

  const discountPaisa = coupon?.discountPaisa ?? 0;
  const totalPaisa = Math.max(0, view.subtotalPaisa - discountPaisa);

  return (
    <div className="grid gap-8 lg:grid-cols-12">
      <div className="lg:col-span-8">
        {view.warnings.length > 0 && (
          <div className="mb-4 flex flex-col gap-2">
            {view.warnings.map((warning, index) => (
              <Alert key={`${warning.variantId}-${warning.type}-${index}`} variant="warning">
                <AlertDescription>{warning.message}</AlertDescription>
              </Alert>
            ))}
          </div>
        )}

        <div className="mb-3 hidden grid-cols-[1fr_auto] gap-4 rounded-xl border border-outline-variant bg-surface px-5 py-3 font-mono text-label-mono-xs text-on-surface-variant sm:grid">
          <span>Product</span>
          <span>Quantity · Subtotal</span>
        </div>
        <ul className="panel divide-y divide-outline-variant px-5">
          {toLineItems(view).map((item) => (
            <li key={item.variantId}>
              <CartLineItem
                item={item}
                onQuantityChange={(quantity) => handleQuantityChange(item.variantId, quantity)}
                onRemove={() => handleRemove(item.variantId)}
              />
            </li>
          ))}
        </ul>

        <Button variant="outline" asChild className="mt-4">
          <Link href="/shop">
            <ArrowLeft aria-hidden="true" />
            Continue shopping
          </Link>
        </Button>
      </div>

      <div className="lg:col-span-4">
        <OrderSummaryPanel
          subtotal={view.subtotalPaisa}
          discount={discountPaisa > 0 ? discountPaisa : undefined}
          total={totalPaisa}
          couponCode={coupon?.code}
          onApplyCoupon={handleApplyCoupon}
          taxInclusiveNote
          primaryAction={
            <Button variant="primary" glow className="w-full" asChild>
              <Link href="/checkout">Proceed to checkout</Link>
            </Button>
          }
          className="lg:sticky lg:top-32"
        />
        <ul className="mt-4 flex flex-col gap-2.5 px-1">
          {CART_ASSURANCES.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-2.5 text-body-sm text-on-surface-variant"
            >
              <Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
