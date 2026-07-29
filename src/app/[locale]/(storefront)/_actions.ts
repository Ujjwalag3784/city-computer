"use server";

/**
 * Storefront cart + coupon Server Actions — docs/17-ROADMAP-PHASES.md
 * Phase 6. Every mutation resolves the caller's cart via
 * `commerce/cart.ts`'s `ensureCartForMutation` (the only place allowed to
 * write the guest-cart cookie — see that function's own doc comment), then
 * always returns the freshly re-resolved `CartView` so the caller never
 * has to guess whether a price/stock warning appeared as a side effect of
 * its own mutation.
 *
 * Rate-limited with the `cartMutation` preset that was already sitting
 * unused in `lib/rate-limit.ts`'s `RATE_LIMIT_PRESETS` — a guest with no
 * session has no stable per-user identifier yet, so the limiter key is
 * "whichever identity we have": the cart's own id once resolved, which is
 * stable across repeat requests from the same browser/cart without
 * needing to read a raw IP header inside a Server Action.
 */
import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { rateLimit } from "@/server/rate-limit-store";
import { getRequestIpFromHeaders } from "@/lib/request-ip";
import {
  addToCartSchema,
  applyCouponSchema,
  removeCartItemSchema,
  updateCartItemSchema,
} from "@/lib/validation/cart";
import {
  addItemToCart,
  ensureCartForMutation,
  getCartView,
  getViewerCart,
  removeItem,
  updateItemQuantity,
  type CartView,
} from "@/server/services/commerce/cart";
import { previewCoupon, type CouponPreview } from "@/server/services/commerce/coupon";
import { db } from "@/server/db";
import { Locale, NewsletterStatus } from "@/generated/prisma/client";
import { newsletterSubscribeSchema } from "@/lib/validation/content";
import { subscribeToNewsletter } from "@/server/services/content/newsletter";
import { runStorefrontAction, type ActionResult } from "./_lib/action-result";

const CART_PATH = "/cart";

async function currentIdentity() {
  const session = await auth();
  return { userId: session?.user?.id, userEmail: session?.user?.email ?? null };
}

/** Read-only — used by the header/mini-cart on mount, never creates a cart. */
export async function getCartAction(): Promise<ActionResult<CartView>> {
  return runStorefrontAction(async () => {
    const identity = await currentIdentity();
    const cart = await getViewerCart(identity);
    if (!cart) return { cartId: "", items: [], subtotalPaisa: 0, itemCount: 0, warnings: [] };
    return getCartView(cart.id);
  });
}

export async function addToCartAction(input: unknown): Promise<ActionResult<CartView>> {
  return runStorefrontAction(async () => {
    const parsed = addToCartSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const identity = await currentIdentity();
    const cart = await ensureCartForMutation(identity);
    await rateLimit("cartMutation", `cart:${cart.id}`);
    await addItemToCart(cart.id, parsed.data.variantId, parsed.data.quantity);

    revalidatePath(CART_PATH);
    return getCartView(cart.id);
  });
}

export async function updateCartItemAction(input: unknown): Promise<ActionResult<CartView>> {
  return runStorefrontAction(async () => {
    const parsed = updateCartItemSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const identity = await currentIdentity();
    const cart = await ensureCartForMutation(identity);
    await rateLimit("cartMutation", `cart:${cart.id}`);
    await updateItemQuantity(cart.id, parsed.data.variantId, parsed.data.quantity);

    revalidatePath(CART_PATH);
    return getCartView(cart.id);
  });
}

export async function removeCartItemAction(input: unknown): Promise<ActionResult<CartView>> {
  return runStorefrontAction(async () => {
    const parsed = removeCartItemSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const identity = await currentIdentity();
    const cart = await ensureCartForMutation(identity);
    await rateLimit("cartMutation", `cart:${cart.id}`);
    await removeItem(cart.id, parsed.data.variantId);

    revalidatePath(CART_PATH);
    return getCartView(cart.id);
  });
}

export interface ApplyCouponResult {
  cart: CartView;
  coupon: CouponPreview | null;
}

/** An empty `code` clears the applied coupon (`OrderSummaryPanel`'s own documented convention) rather than needing a second action. */
export async function applyCouponAction(input: unknown): Promise<ActionResult<ApplyCouponResult>> {
  return runStorefrontAction(async () => {
    const parsed = applyCouponSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const identity = await currentIdentity();
    const cart = await ensureCartForMutation(identity);
    await rateLimit("cartMutation", `cart:${cart.id}`);

    if (parsed.data.code === "") {
      await db.cart.update({ where: { id: cart.id }, data: { couponCode: null } });
      revalidatePath(CART_PATH);
      return { cart: await getCartView(cart.id), coupon: null };
    }

    const cartView = await getCartView(cart.id);
    const customerId = identity.userId
      ? (await db.customer.findUnique({ where: { userId: identity.userId }, select: { id: true } }))
          ?.id
      : undefined;
    const coupon = await previewCoupon(parsed.data.code, cartView, customerId);

    await db.cart.update({ where: { id: cart.id }, data: { couponCode: coupon.code } });
    revalidatePath(CART_PATH);
    return { cart: cartView, coupon };
  });
}

/**
 * `SiteFooter`'s newsletter form (Phase 10) — the form itself has existed
 * since Phase 2 as presentational-only, with its own doc comment noting
 * "no newsletter API route exists yet... a later phase." This is that
 * later phase. Lives in this shared, layout-wide actions file (not a
 * route-scoped `_actions.ts`) because `SiteFooter` renders on every
 * storefront page via `(storefront)/layout.tsx`, not one specific route.
 */
export async function subscribeNewsletterAction(
  input: unknown,
): Promise<ActionResult<{ status: NewsletterStatus }>> {
  return runStorefrontAction(async () => {
    const parsed = newsletterSubscribeSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const ip = await getRequestIpFromHeaders();
    await rateLimit("newsletterSubscribe", `ip:${ip}`);

    return subscribeToNewsletter(parsed.data.email, Locale.EN, "footer");
  });
}
