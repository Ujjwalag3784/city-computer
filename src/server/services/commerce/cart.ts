/**
 * The cart service — docs/17-ROADMAP-PHASES.md Phase 6 ("Cart &
 * Inventory") and docs/06-DATA-MODEL.md §6's `Cart`/`CartItem`.
 *
 * THE CORE RULE THIS FILE EXISTS TO ENFORCE (docs/06 §6, verbatim):
 * "Price is re-resolved server-side at checkout. The snapshot exists only
 * to detect and surface 'the price changed since you added this'."
 * `CartItem.unitPricePaisaSnapshot` is written on add and never trusted for
 * money math — every subtotal in `getCartView` is computed from each
 * variant's *current* `pricePaisa`, and the snapshot is used only to build
 * `CartWarning`s.
 *
 * STOCK RULE (docs/06 §5, deliberately followed to the letter): "Reserved
 * on order placement, not add-to-cart (avoids denial-of-inventory abuse)."
 * Nothing in this file creates a `StockReservation` — adding to cart only
 * checks *available* stock (`quantity - reservedQuantity`, from
 * `admin/stock.ts`'s shared branch-scoped read) to give an honest "only 2
 * left" signal, it never holds that stock against other shoppers. Real
 * reservation happens at order placement (`stock-reservation.ts`), which
 * this codebase has no checkout screen calling yet — see that file's own
 * header comment.
 *
 * IDENTITY: a cart belongs to either a guest (identified by an opaque
 * `token` cookie, `ids.ts`'s `generateCartToken`) or a signed-in customer
 * (identified by `Cart.customerId`). `Cart.token` is a required, unique
 * column on every row regardless — even a customer's cart gets a token
 * generated for it, it's just never put in a cookie for a signed-in
 * shopper (`Cart.customerId` is the real lookup key at that point).
 *
 * SCOPE NOTE (matches `admin/stock.ts`'s own documented limitation): reads
 * and writes stock against the single default fulfilment branch only, the
 * same one every other stock-aware screen in this codebase uses today.
 * `Cart.branchId` is left null — a per-cart branch selector (e.g. "pickup
 * from Pokhara branch") is a real, separate feature this pass doesn't add.
 */
import "server-only";
import { cookies } from "next/headers";
import { db } from "@/server/db";
import { AppError, NotFoundError } from "@/lib/errors";
import { generateCartToken } from "@/lib/ids";
import { getPrimaryStockLevelsByVariantId } from "@/server/services/admin/stock";
import { env } from "@/env";
import type { Cart } from "@/generated/prisma/client";

export const CART_COOKIE_NAME = "cc_cart_token";
const GUEST_CART_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const CART_COOKIE_MAX_AGE_SECONDS = GUEST_CART_TTL_MS / 1000;
/**
 * `Cart.expiresAt` is a required column (docs/06 §6 doesn't model it as
 * nullable), but "customer carts persist" — there is no real expiry for
 * them. Ten years is a sentinel meaning "doesn't expire in practice", not
 * a real business rule; a future cart-expiry sweep job must exclude
 * `customerId IS NOT NULL` rows rather than reading this value as
 * meaningful, and that exclusion is flagged here rather than silently
 * assumed.
 */
const CUSTOMER_CART_SENTINEL_TTL_MS = 10 * 365 * 24 * 60 * 60 * 1000;

export interface CartWarning {
  variantId: string;
  type: "PRICE_CHANGED" | "STOCK_REDUCED" | "OUT_OF_STOCK" | "NO_LONGER_AVAILABLE";
  message: string;
  previousUnitPricePaisa?: number;
  currentUnitPricePaisa?: number;
  availableQuantity?: number;
}

export interface CartViewItem {
  variantId: string;
  productId: string;
  productSlug: string;
  productName: string;
  variantLabel: string | null;
  imageUrl: string | null;
  imageAlt: string;
  /** Current, re-resolved price — never the stored snapshot. */
  unitPricePaisa: number;
  quantity: number;
  lineTotalPaisa: number;
  availableQuantity: number;
  isOutOfStock: boolean;
}

export interface CartView {
  cartId: string;
  items: CartViewItem[];
  /** Sum of every line's current-price total. Integer paisa. */
  subtotalPaisa: number;
  /** Sum of every line's quantity — what a header badge should show. */
  itemCount: number;
  warnings: CartWarning[];
}

export interface CartIdentity {
  userId?: string;
  /** Session user's email, used only as a fallback if a `Customer` row has to be created on the fly (see `findOrCreateCustomerId`'s doc comment — registration is supposed to always create one, but that isn't a DB-enforced invariant). */
  userEmail?: string | null;
}

// ---------------------------------------------------------------------------
// Cookie helpers — the first cookie-reading/writing code in this codebase.
// Reading is safe anywhere (Server Components included); writing is only
// legal inside a Server Action or Route Handler, so `ensureCartForMutation`
// is the only function that ever calls the setters.
// ---------------------------------------------------------------------------

export async function readCartCookieToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(CART_COOKIE_NAME)?.value ?? null;
}

async function writeCartCookieToken(token: string): Promise<void> {
  const store = await cookies();
  store.set(CART_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    maxAge: CART_COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });
}

async function clearCartCookieToken(): Promise<void> {
  const store = await cookies();
  store.delete(CART_COOKIE_NAME);
}

/**
 * `User.id` (Auth.js) -> `Customer.id` bridge. Registration
 * (`auth/register.ts`) always creates a `Customer` row alongside the
 * `User`, but that's a service-level convention, not a foreign-key
 * requirement — so this still handles the "somehow missing" case with a
 * create-if-missing fallback rather than assuming the invariant holds.
 */
export async function findOrCreateCustomerId(identity: CartIdentity): Promise<string> {
  if (!identity.userId) {
    throw new AppError("VALIDATION_FAILED", "A signed-in user is required to resolve a customer.");
  }
  const existing = await db.customer.findUnique({
    where: { userId: identity.userId },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await db.customer.create({
    data: { userId: identity.userId, email: identity.userEmail ?? null },
    select: { id: true },
  });
  return created.id;
}

/**
 * Read-only cart lookup for Server Components (page renders) — never
 * creates a cart and never touches cookies, since a mere page view
 * shouldn't mint a new empty cart or attempt a cookie write outside a
 * Server Action/Route Handler (which would throw). Returns `null` when the
 * viewer has no cart yet, which every caller should render as an empty
 * cart / a `cartCount` of 0.
 */
export async function getViewerCart(identity: CartIdentity): Promise<Cart | null> {
  if (identity.userId) {
    const customer = await db.customer.findUnique({
      where: { userId: identity.userId },
      select: { id: true },
    });
    if (!customer) return null;
    // `Cart.customerId` is indexed but not DB-unique (the schema leaves "one
    // active cart per customer" as a service-level convention rather than a
    // constraint) — `findFirst` rather than `findUnique`, newest first in
    // case that convention was ever violated.
    return db.cart.findFirst({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
    });
  }
  const token = await readCartCookieToken();
  if (!token) return null;
  return db.cart.findUnique({ where: { token } });
}

/**
 * Sums `CartItem.quantity` from the guest cart into the customer cart
 * (docs/06 §6: "Merged on login by SKU with quantity summing"), then
 * deletes the now-empty guest cart. Deleting cascades its `CartItem` rows
 * (`onDelete: Cascade` in the schema); any `StockReservation` rows
 * pointing at it fall back to `cartId: null` (`onDelete: SetNull`) rather
 * than being deleted, which is correct — a reservation's validity doesn't
 * depend on the cart row surviving.
 */
async function mergeGuestCartIntoCustomerCart(
  guestCartId: string,
  customerCartId: string,
): Promise<void> {
  const guestItems = await db.cartItem.findMany({ where: { cartId: guestCartId } });
  for (const item of guestItems) {
    const existing = await db.cartItem.findUnique({
      where: { cartId_variantId: { cartId: customerCartId, variantId: item.variantId } },
    });
    if (existing) {
      await db.cartItem.update({
        where: { id: existing.id },
        data: { quantity: existing.quantity + item.quantity },
      });
    } else {
      await db.cartItem.create({
        data: {
          cartId: customerCartId,
          variantId: item.variantId,
          quantity: item.quantity,
          unitPricePaisaSnapshot: item.unitPricePaisaSnapshot,
          buildId: item.buildId,
        },
      });
    }
  }
  await db.cart.delete({ where: { id: guestCartId } });
}

/**
 * The one function every cart-mutating Server Action calls first. Unlike
 * `getViewerCart`, this always returns a real `Cart` row — creating one
 * (and, for a guest, writing the cookie) if none exists yet — and performs
 * the guest-cart-to-customer-cart merge the moment a signed-in shopper
 * turns out to also be carrying a guest cart cookie.
 */
export async function ensureCartForMutation(identity: CartIdentity): Promise<Cart> {
  if (identity.userId) {
    const customerId = await findOrCreateCustomerId(identity);
    // See `getViewerCart`'s comment — `customerId` isn't DB-unique, so this
    // is a `findFirst`, not a `findUnique`.
    const existingCustomerCart = await db.cart.findFirst({
      where: { customerId },
      orderBy: { createdAt: "desc" },
    });

    const guestToken = await readCartCookieToken();
    const guestCart = guestToken
      ? await db.cart.findUnique({ where: { token: guestToken } })
      : null;

    if (existingCustomerCart) {
      if (guestCart && guestCart.id !== existingCustomerCart.id) {
        await mergeGuestCartIntoCustomerCart(guestCart.id, existingCustomerCart.id);
        await clearCartCookieToken();
      }
      return existingCustomerCart;
    }

    if (guestCart) {
      // No customer cart yet — the guest cart simply becomes the customer's
      // cart rather than merging into an empty target.
      const adopted = await db.cart.update({
        where: { id: guestCart.id },
        data: { customerId, expiresAt: new Date(Date.now() + CUSTOMER_CART_SENTINEL_TTL_MS) },
      });
      await clearCartCookieToken();
      return adopted;
    }

    return db.cart.create({
      data: {
        token: generateCartToken(),
        customerId,
        expiresAt: new Date(Date.now() + CUSTOMER_CART_SENTINEL_TTL_MS),
      },
    });
  }

  const token = await readCartCookieToken();
  if (token) {
    const existing = await db.cart.findUnique({ where: { token } });
    if (existing) {
      // Sliding expiry — an active guest cart keeps its 30-day window
      // rolling forward rather than expiring mid-shop.
      return db.cart.update({
        where: { id: existing.id },
        data: { lastActivityAt: new Date(), expiresAt: new Date(Date.now() + GUEST_CART_TTL_MS) },
      });
    }
  }

  const newToken = generateCartToken();
  const created = await db.cart.create({
    data: { token: newToken, expiresAt: new Date(Date.now() + GUEST_CART_TTL_MS) },
  });
  await writeCartCookieToken(newToken);
  return created;
}

interface VariantCartContext {
  pricePaisa: number;
  isActive: boolean;
  isDeleted: boolean;
  allowBackorder: boolean;
  productId: string;
  productSlug: string;
  productName: string;
  variantLabel: string | null;
  imageUrl: string | null;
  imageAlt: string;
}

/** Picks the same thumbnail-first, gallery-fallback image `catalog/product.ts`'s `pickCardImage` uses, kept as its own small copy here since that function is module-private to `product.ts` and a cart line item needs the identical rule, not a new one. */
function pickLineItemImage(
  media: { role: string; media: { url: string; cdnUrl: string | null; altText: string | null } }[],
  fallbackAlt: string,
): { url: string | null; alt: string } {
  const thumbnail = media.find((entry) => entry.role === "THUMBNAIL");
  const gallery = media.find((entry) => entry.role === "GALLERY");
  const chosen = thumbnail ?? gallery ?? media[0];
  if (!chosen) return { url: null, alt: fallbackAlt };
  return { url: chosen.media.cdnUrl ?? chosen.media.url, alt: chosen.media.altText ?? fallbackAlt };
}

async function resolveVariantCartContext(
  variantIds: string[],
): Promise<Map<string, VariantCartContext>> {
  if (variantIds.length === 0) return new Map();
  const variants = await db.variant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      pricePaisa: true,
      isActive: true,
      deletedAt: true,
      allowBackorder: true,
      title: true,
      productId: true,
      product: {
        select: {
          slug: true,
          displayTitle: true,
          media: {
            orderBy: { position: "asc" },
            select: { role: true, media: { select: { url: true, cdnUrl: true, altText: true } } },
          },
        },
      },
    },
  });

  return new Map(
    variants.map((variant) => {
      const image = pickLineItemImage(variant.product.media, variant.product.displayTitle);
      return [
        variant.id,
        {
          pricePaisa: variant.pricePaisa,
          isActive: variant.isActive,
          isDeleted: variant.deletedAt !== null,
          allowBackorder: variant.allowBackorder,
          productId: variant.productId,
          productSlug: variant.product.slug,
          productName: variant.product.displayTitle,
          variantLabel: variant.title,
          imageUrl: image.url,
          imageAlt: image.alt,
        },
      ];
    }),
  );
}

/**
 * Adds `quantity` more of a variant to the cart (creating the line if it's
 * the first of this variant, otherwise incrementing an existing line's
 * quantity — `CartItem`'s unique `(cartId, variantId)` constraint is the
 * mechanism that makes "one line per variant" true). Refreshes
 * `unitPricePaisaSnapshot` to the *current* price on every add — the
 * snapshot means "the price the last time this line was touched", not
 * "the price the first time it was ever added".
 *
 * Only checks *available* stock (`quantity - reservedQuantity`); never
 * reserves it — see this file's header comment.
 */
export async function addItemToCart(
  cartId: string,
  variantId: string,
  quantity: number,
  /** Set when this line comes from a PC build's "Add to Cart" (`CartItem.buildId`) — see `builder/builds.ts`'s `addBuildToCart`, which is the only caller that passes this. Every other call site omits it, so ordinary PDP/quick-add behavior is unchanged. */
  buildId?: string,
): Promise<void> {
  const context = (await resolveVariantCartContext([variantId])).get(variantId);
  if (!context || context.isDeleted) throw new NotFoundError("Product option");
  if (!context.isActive) {
    throw new AppError("VALIDATION_FAILED", "This product option is no longer available.");
  }

  const existing = await db.cartItem.findUnique({
    where: { cartId_variantId: { cartId, variantId } },
    select: { quantity: true },
  });
  const newLineQuantity = (existing?.quantity ?? 0) + quantity;

  if (!context.allowBackorder) {
    const stockByVariant = await getPrimaryStockLevelsByVariantId([variantId]);
    const availableQuantity = stockByVariant.get(variantId)?.availableQuantity ?? 0;
    if (newLineQuantity > availableQuantity) {
      throw new AppError(
        "INSUFFICIENT_STOCK",
        availableQuantity === 0
          ? "That's out of stock right now."
          : `Only ${availableQuantity} left in stock.`,
      );
    }
  }

  await db.cartItem.upsert({
    where: { cartId_variantId: { cartId, variantId } },
    create: { cartId, variantId, quantity, unitPricePaisaSnapshot: context.pricePaisa, buildId },
    update: { quantity: newLineQuantity, unitPricePaisaSnapshot: context.pricePaisa, buildId },
  });
  await db.cart.update({ where: { id: cartId }, data: { lastActivityAt: new Date() } });
}

/**
 * Sets a line to an exact quantity (the cart page's stepper), or removes
 * it outright when `quantity` is 0. Deliberately does not touch
 * `unitPricePaisaSnapshot` — only `addItemToCart` refreshes that, so a
 * plain quantity edit on the cart page can still legitimately surface a
 * "price changed" warning for a line the shopper hasn't re-added to.
 */
export async function updateItemQuantity(
  cartId: string,
  variantId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    await removeItem(cartId, variantId);
    return;
  }

  const context = (await resolveVariantCartContext([variantId])).get(variantId);
  if (!context || context.isDeleted) throw new NotFoundError("Product option");

  if (!context.allowBackorder) {
    const stockByVariant = await getPrimaryStockLevelsByVariantId([variantId]);
    const availableQuantity = stockByVariant.get(variantId)?.availableQuantity ?? 0;
    if (quantity > availableQuantity) {
      throw new AppError(
        "INSUFFICIENT_STOCK",
        availableQuantity === 0
          ? "That's out of stock right now."
          : `Only ${availableQuantity} left in stock.`,
      );
    }
  }

  await db.cartItem.update({
    where: { cartId_variantId: { cartId, variantId } },
    data: { quantity },
  });
  await db.cart.update({ where: { id: cartId }, data: { lastActivityAt: new Date() } });
}

export async function removeItem(cartId: string, variantId: string): Promise<void> {
  await db.cartItem.deleteMany({ where: { cartId, variantId } });
  await db.cart.update({ where: { id: cartId }, data: { lastActivityAt: new Date() } });
}

/**
 * Builds the shopper-facing view of a cart: current prices and stock
 * re-resolved fresh for every line, with `warnings[]` surfacing anything
 * that drifted since the line was added — docs/17 Phase 6's acceptance
 * criterion "cart warnings surface on price and stock change".
 */
export async function getCartView(cartId: string): Promise<CartView> {
  const cartItems = await db.cartItem.findMany({ where: { cartId }, orderBy: { addedAt: "asc" } });
  if (cartItems.length === 0) {
    return { cartId, items: [], subtotalPaisa: 0, itemCount: 0, warnings: [] };
  }

  const variantIds = cartItems.map((item) => item.variantId);
  const [contextByVariant, stockByVariant] = await Promise.all([
    resolveVariantCartContext(variantIds),
    getPrimaryStockLevelsByVariantId(variantIds),
  ]);

  const items: CartViewItem[] = [];
  const warnings: CartWarning[] = [];
  let subtotalPaisa = 0;
  let itemCount = 0;

  for (const cartItem of cartItems) {
    const context = contextByVariant.get(cartItem.variantId);
    if (!context || context.isDeleted || !context.isActive) {
      warnings.push({
        variantId: cartItem.variantId,
        type: "NO_LONGER_AVAILABLE",
        message: "This product is no longer available and was removed from your cart.",
      });
      // Not shown as a line item, and not counted toward the subtotal — a
      // gone-for-good variant can't be re-priced or re-stocked-checked.
      await db.cartItem.deleteMany({ where: { cartId, variantId: cartItem.variantId } });
      continue;
    }

    const availableQuantity = stockByVariant.get(cartItem.variantId)?.availableQuantity ?? 0;
    const isOutOfStock = !context.allowBackorder && availableQuantity <= 0;

    if (context.pricePaisa !== cartItem.unitPricePaisaSnapshot) {
      warnings.push({
        variantId: cartItem.variantId,
        type: "PRICE_CHANGED",
        message: "The price of this item changed since you added it.",
        previousUnitPricePaisa: cartItem.unitPricePaisaSnapshot,
        currentUnitPricePaisa: context.pricePaisa,
      });
    }
    if (!context.allowBackorder && cartItem.quantity > availableQuantity) {
      warnings.push({
        variantId: cartItem.variantId,
        type: isOutOfStock ? "OUT_OF_STOCK" : "STOCK_REDUCED",
        message: isOutOfStock
          ? "This item is out of stock."
          : `Only ${availableQuantity} left — your cart quantity was more than that.`,
        availableQuantity,
      });
    }

    const lineTotalPaisa = context.pricePaisa * cartItem.quantity;
    subtotalPaisa += lineTotalPaisa;
    itemCount += cartItem.quantity;

    items.push({
      variantId: cartItem.variantId,
      productId: context.productId,
      productSlug: context.productSlug,
      productName: context.productName,
      variantLabel: context.variantLabel,
      imageUrl: context.imageUrl,
      imageAlt: context.imageAlt,
      unitPricePaisa: context.pricePaisa,
      quantity: cartItem.quantity,
      lineTotalPaisa,
      availableQuantity,
      isOutOfStock,
    });
  }

  return { cartId, items, subtotalPaisa, itemCount, warnings };
}
