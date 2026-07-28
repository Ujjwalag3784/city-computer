/**
 * Coupon validation + discount preview — docs/06-DATA-MODEL.md §6's
 * `Coupon`/`CouponRedemption` and docs/17-ROADMAP-PHASES.md Phase 6's
 * "coupon application" deliverable.
 *
 * PREVIEW ONLY, NOT REDEMPTION: `CouponRedemption` requires a real
 * `orderId` (docs/06 §6: "Unique (couponId, orderId)"), so applying a
 * coupon to a cart can only ever be a stateless computation against the
 * cart's current contents — it stores `Cart.couponCode` (the one field the
 * `Cart` model actually has for this) and returns a discount figure, but
 * writes no `CouponRedemption` row and does not increment
 * `Coupon.usedCount`. That happens at order placement, which — same as
 * `stock-reservation.ts` — this codebase has no screen for yet.
 */
import "server-only";
import { db } from "@/server/db";
import { CouponType, CouponAppliesTo } from "@/generated/prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { formatNPR, percentageOfPaisa } from "@/lib/money";
import type { CartView } from "./cart";

export interface CouponPreview {
  code: string;
  type: CouponType;
  discountPaisa: number;
  freeShipping: boolean;
}

/**
 * `code` is normalised to uppercase on write (`Coupon.code`'s own doc
 * comment) — this mirrors that at read time so a shopper typing lowercase
 * still matches.
 */
function normalizeCouponCode(code: string): string {
  return code.trim().toUpperCase();
}

async function isFirstOrderCustomer(customerId: string): Promise<boolean> {
  const count = await db.order.count({ where: { customerId } });
  return count === 0;
}

function isEligibleLine(
  appliesTo: CouponAppliesTo,
  targetIds: string[],
  line: {
    productId: string;
    brandId: string;
    primaryCategoryId: string;
    hasCompareAtPrice: boolean;
  },
  excludeDiscounted: boolean,
): boolean {
  if (excludeDiscounted && line.hasCompareAtPrice) return false;
  switch (appliesTo) {
    case CouponAppliesTo.ALL:
      return true;
    case CouponAppliesTo.PRODUCT:
      return targetIds.includes(line.productId);
    case CouponAppliesTo.BRAND:
      return targetIds.includes(line.brandId);
    case CouponAppliesTo.CATEGORY:
      // Simplification, flagged rather than silent: matches only a
      // product's canonical `primaryCategoryId`, not every category it
      // cross-lists into via `ProductCategory` — the many-to-many table
      // that would need a second query per line. A product's *primary*
      // category is the one docs/06 §4 itself calls "canonical for
      // breadcrumbs and URLs", so this is a reasonable first cut, not an
      // arbitrary shortcut.
      return targetIds.includes(line.primaryCategoryId);
  }
}

/**
 * Validates a coupon code against a cart and computes the discount it
 * would produce — does not mutate anything. Throws `COUPON_INVALID` /
 * `COUPON_EXPIRED` / `COUPON_LIMIT_REACHED` (all pre-defined `ErrorCode`s)
 * rather than returning a `{ valid: false }` shape, matching this
 * codebase's general convention of throwing `AppError` from service
 * functions rather than a boxed `Result`.
 */
export async function previewCoupon(
  rawCode: string,
  cart: CartView,
  customerId?: string,
): Promise<CouponPreview> {
  const code = normalizeCouponCode(rawCode);
  const coupon = await db.coupon.findUnique({ where: { code } });
  if (!coupon) throw new AppError("COUPON_INVALID", "That coupon code doesn't exist.");
  if (!coupon.isActive) throw new AppError("COUPON_INVALID", "This coupon is no longer active.");

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    throw new AppError("COUPON_INVALID", "This coupon isn't active yet.");
  }
  if (coupon.endsAt && coupon.endsAt < now) {
    throw new AppError("COUPON_EXPIRED", "This coupon has expired.");
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    throw new AppError(
      "COUPON_LIMIT_REACHED",
      "This coupon has already been used the maximum number of times.",
    );
  }
  if (coupon.usageLimitPerCustomer !== null) {
    if (!customerId) {
      throw new AppError("COUPON_INVALID", "Sign in to use this coupon.");
    }
    const redemptions = await db.couponRedemption.count({
      where: { couponId: coupon.id, customerId },
    });
    if (redemptions >= coupon.usageLimitPerCustomer) {
      throw new AppError(
        "COUPON_LIMIT_REACHED",
        "You've already used this coupon the maximum number of times.",
      );
    }
  }
  if (coupon.firstOrderOnly) {
    if (!customerId || !(await isFirstOrderCustomer(customerId))) {
      throw new AppError("COUPON_INVALID", "This coupon is only valid on a first order.");
    }
  }
  if (coupon.minOrderPaisa !== null && cart.subtotalPaisa < coupon.minOrderPaisa) {
    throw new AppError(
      "COUPON_INVALID",
      `This coupon needs a minimum order of ${formatNPR(coupon.minOrderPaisa)}.`,
    );
  }
  if (cart.items.length === 0) {
    throw new AppError("CART_EMPTY", "Your cart is empty.");
  }

  if (coupon.type === CouponType.FREE_SHIPPING) {
    return { code, type: coupon.type, discountPaisa: 0, freeShipping: true };
  }

  const productIds = cart.items.map((item) => item.productId);
  const productDetails = await db.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, brandId: true, primaryCategoryId: true },
  });
  const productDetailById = new Map(productDetails.map((product) => [product.id, product]));

  let eligibleSubtotalPaisa = 0;
  for (const item of cart.items) {
    const detail = productDetailById.get(item.productId);
    if (!detail) continue;
    const eligible = isEligibleLine(
      coupon.appliesTo,
      coupon.targetIds,
      {
        productId: item.productId,
        brandId: detail.brandId,
        primaryCategoryId: detail.primaryCategoryId,
        // `CartViewItem` doesn't carry `compareAtPricePaisa` today — this
        // preview treats "excludeDiscounted" as a no-op until that field
        // is threaded through, rather than silently guessing. Flagged,
        // not faked.
        hasCompareAtPrice: false,
      },
      coupon.excludeDiscounted,
    );
    if (eligible) eligibleSubtotalPaisa += item.lineTotalPaisa;
  }

  if (eligibleSubtotalPaisa === 0) {
    throw new AppError("COUPON_INVALID", "Nothing in your cart qualifies for this coupon.");
  }

  let discountPaisa: number;
  if (coupon.type === CouponType.PERCENTAGE) {
    discountPaisa = percentageOfPaisa(eligibleSubtotalPaisa, coupon.value);
  } else {
    // FIXED_AMOUNT: `coupon.value` is already paisa (docs/06 §6: "paisa,
    // else percentage points"). Never discount more than the eligible
    // subtotal itself.
    discountPaisa = Math.min(coupon.value, eligibleSubtotalPaisa);
  }
  if (coupon.maxDiscountPaisa !== null) {
    discountPaisa = Math.min(discountPaisa, coupon.maxDiscountPaisa);
  }

  return { code, type: coupon.type, discountPaisa, freeShipping: false };
}

export async function getCouponByCode(code: string) {
  const coupon = await db.coupon.findUnique({ where: { code: normalizeCouponCode(code) } });
  if (!coupon) throw new NotFoundError("Coupon");
  return coupon;
}
