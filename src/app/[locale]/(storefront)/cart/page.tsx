import type { Metadata } from "next";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getViewerCart, getCartView, type CartView } from "@/server/services/commerce/cart";
import { previewCoupon, type CouponPreview } from "@/server/services/commerce/coupon";
import { LISTING_PAGE_CLASS, ListingHeader } from "@/components/commerce/listing-header";
import { CartPageClient } from "./_components/cart-page-client";

export const metadata: Metadata = {
  title: "Your Cart — City Computer Systems",
};

const EMPTY_CART_VIEW: CartView = {
  cartId: "",
  items: [],
  subtotalPaisa: 0,
  itemCount: 0,
  warnings: [],
};

/** Best-effort restore of an already-applied coupon's discount for display — `Cart.couponCode` only stores the code, not the discount figure, so this re-runs the same read-only preview `applyCouponAction` uses. A coupon that became invalid between visits (expired, used up) is silently dropped here rather than failing the whole page render — the shopper can just re-apply a valid one. */
async function restoreAppliedCoupon(
  couponCode: string | null,
  view: CartView,
  customerId: string | undefined,
): Promise<CouponPreview | null> {
  if (!couponCode) return null;
  try {
    return await previewCoupon(couponCode, view, customerId);
  } catch {
    return null;
  }
}

/**
 * `/cart` — docs/17-ROADMAP-PHASES.md Phase 6's "cart page" deliverable,
 * the full 8/4 (line items ‖ sticky `OrderSummaryPanel`) layout docs/05
 * §8 describes, `MiniCartDrawer`'s own "Go to checkout" link's real
 * destination (previously a genuine 404 — see this route's absence noted
 * in the storefront layout's pre-Phase-6 doc comment).
 *
 * Server Component: reads the viewer's cart read-only (`getViewerCart` —
 * never creates one or writes a cookie, see that function's own doc
 * comment) and passes the resolved `CartView` to the client component that
 * owns every interactive piece (quantity edits, removal, coupon apply).
 */
export default async function CartPage() {
  const session = await auth();
  const identity = { userId: session?.user?.id, userEmail: session?.user?.email ?? null };
  const cart = await getViewerCart(identity);
  const view = cart ? await getCartView(cart.id) : EMPTY_CART_VIEW;

  const customer = identity.userId
    ? await db.customer.findUnique({ where: { userId: identity.userId }, select: { id: true } })
    : null;
  const initialCoupon = await restoreAppliedCoupon(cart?.couponCode ?? null, view, customer?.id);

  return (
    <div className={LISTING_PAGE_CLASS}>
      <ListingHeader
        eyebrow={`Cart // ${view.itemCount} item${view.itemCount === 1 ? "" : "s"}`}
        title="Review your order"
        description="Check quantities and apply a coupon before you check out. Prices are rechecked live."
      />
      <CartPageClient initialView={view} initialCoupon={initialCoupon} />
    </div>
  );
}
