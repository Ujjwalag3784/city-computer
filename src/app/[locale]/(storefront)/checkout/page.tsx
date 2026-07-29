import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getViewerCart, getCartView } from "@/server/services/commerce/cart";
import { CheckoutPageClient } from "./_components/checkout-page-client";

export const metadata: Metadata = {
  title: "Checkout — City Computer Systems",
};

/**
 * `/checkout` — docs/17-ROADMAP-PHASES.md Phase 7's 3-step checkout.
 * Server Component: resolves the viewer's cart read-only (same
 * `getViewerCart`/`getCartView` pair `/cart` itself uses — never creates a
 * cart or writes a cookie) and the list of pickup-eligible branches, then
 * hands both to the client wizard that owns every interactive step.
 *
 * An empty cart, a missing cart, or a cart with anything currently out of
 * stock all redirect back to `/cart` rather than rendering a checkout page
 * that `placeOrderAction` would just reject anyway (`order.ts`'s own
 * `INSUFFICIENT_STOCK` guard) — the shopper should fix the cart first,
 * with the cart page's own line-item warnings to guide them.
 */
export default async function CheckoutPage() {
  const session = await auth();
  const identity = { userId: session?.user?.id, userEmail: session?.user?.email ?? null };

  const cart = await getViewerCart(identity);
  if (!cart) redirect("/cart");

  const cartView = await getCartView(cart.id);
  if (cartView.items.length === 0) redirect("/cart");
  if (cartView.items.some((item) => item.isOutOfStock)) redirect("/cart");

  const branches = await db.branch.findMany({
    where: { isActive: true, isPickupEnabled: true },
    orderBy: [{ isDefaultFulfilment: "desc" }, { position: "asc" }],
    select: { id: true, name: true, addressLine: true, district: true },
  });

  return (
    <div className="mx-auto max-w-[1280px] px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-6 text-headline-md text-on-surface">Checkout</h1>
      <CheckoutPageClient cartView={cartView} branches={branches} />
    </div>
  );
}
