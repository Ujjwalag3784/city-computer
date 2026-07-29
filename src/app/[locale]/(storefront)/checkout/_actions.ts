"use server";

/**
 * Checkout Server Actions — docs/17-ROADMAP-PHASES.md Phase 7's 3-step
 * checkout. Two actions: a read-only live quote (re-run on every address/
 * fulfilment change so the shopper never sees a shipping/VAT figure that
 * could drift from what `placeOrderAction` actually charges), and the
 * order-placement commit itself.
 *
 * Same "Server Actions must return plain serialisable `ActionResult<T>`,
 * never a thrown `AppError`" contract as `(storefront)/_actions.ts`.
 */
import { auth } from "@/server/auth";
import { validationErrorFromZodIssues, AppError } from "@/lib/errors";
import { rateLimit } from "@/server/rate-limit-store";
import { checkoutQuoteSchema, placeOrderSchema } from "@/lib/validation/checkout";
import { getViewerCart, getCartView } from "@/server/services/commerce/cart";
import { previewCoupon } from "@/server/services/commerce/coupon";
import { getCheckoutQuote, type CheckoutQuote } from "@/server/services/commerce/checkout";
import { placeOrder } from "@/server/services/commerce/order";
import { db } from "@/server/db";
import { runStorefrontAction, type ActionResult } from "../_lib/action-result";

async function currentIdentity() {
  const session = await auth();
  return { userId: session?.user?.id, userEmail: session?.user?.email ?? null };
}

/**
 * Re-derives the live discount for the viewer's already-applied coupon
 * (`Cart.couponCode` only stores the code, never the discount figure —
 * same reasoning as `/cart`'s own `restoreAppliedCoupon`). A coupon that
 * became invalid between the cart page and checkout is silently dropped
 * here (returns 0) rather than blocking the quote — `placeOrder` re-runs
 * this same check at commit time and is the actual source of truth.
 */
async function resolveAppliedDiscountPaisa(
  cartId: string,
  couponCode: string | null,
  cartView: Awaited<ReturnType<typeof getCartView>>,
  userId: string | undefined,
): Promise<number> {
  if (!couponCode) return 0;
  try {
    const customerId = userId
      ? (await db.customer.findUnique({ where: { userId }, select: { id: true } }))?.id
      : undefined;
    const coupon = await previewCoupon(couponCode, cartView, customerId);
    return coupon.discountPaisa;
  } catch {
    return 0;
  }
}

/**
 * Step 1/2's live preview — every field change that could move the
 * quote (district, fulfilment type) re-calls this rather than the client
 * ever computing shipping/VAT itself.
 */
export async function getCheckoutQuoteAction(input: unknown): Promise<ActionResult<CheckoutQuote>> {
  return runStorefrontAction(async () => {
    const parsed = checkoutQuoteSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const identity = await currentIdentity();
    const cart = await getViewerCart(identity);
    if (!cart) throw new AppError("CART_EMPTY", "Your cart is empty.");

    const cartView = await getCartView(cart.id);
    if (cartView.items.length === 0) throw new AppError("CART_EMPTY", "Your cart is empty.");

    const discountPaisa = await resolveAppliedDiscountPaisa(
      cart.id,
      cart.couponCode,
      cartView,
      identity.userId,
    );

    return getCheckoutQuote(
      cartView,
      parsed.data.district,
      parsed.data.fulfilmentType,
      discountPaisa,
    );
  });
}

export interface PlaceOrderResult {
  orderId: string;
  orderNumber: string;
}

/**
 * The commit step. Re-validates the full payload against `placeOrderSchema`
 * (never trusts the client's step-by-step client-side checks alone), then
 * hands off to `order.ts`'s `placeOrder`, which is the one place that
 * recomputes every total server-side. Rate-limited per cart — a guest has
 * no stable per-user identifier yet, matching `_actions.ts`'s own
 * `cartMutation` reasoning.
 */
export async function placeOrderAction(input: unknown): Promise<ActionResult<PlaceOrderResult>> {
  return runStorefrontAction(async () => {
    const parsed = placeOrderSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const identity = await currentIdentity();
    const cart = await getViewerCart(identity);
    if (!cart) throw new AppError("CART_EMPTY", "Your cart is empty.");

    await rateLimit("checkoutPlace", `cart:${cart.id}`);

    const order = await placeOrder(cart.id, parsed.data, identity);
    return { orderId: order.id, orderNumber: order.orderNumber };
  });
}
