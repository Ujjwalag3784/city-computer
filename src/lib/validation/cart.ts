/**
 * Storefront cart/coupon input validation — docs/17-ROADMAP-PHASES.md
 * Phase 6. Lives flat under `lib/validation/` (not `lib/validation/admin/`)
 * per the existing convention that only admin-only screens get their own
 * subdirectory (`auth.ts`, `catalog.ts` are the flat precedent).
 */
import { z } from "zod";

/** A generous but real ceiling — this is a small electronics retailer's cart, not a wholesale order form. Applied per line, not per cart. */
export const MAX_CART_ITEM_QUANTITY = 20;

export const addToCartSchema = z.object({
  variantId: z.string().min(1, "Pick a product option."),
  quantity: z.number().int().min(1).max(MAX_CART_ITEM_QUANTITY),
});
export type AddToCartInput = z.infer<typeof addToCartSchema>;

/**
 * `quantity: 0` is a valid input here and means "remove the line" — the
 * cart page's quantity stepper can go straight to zero without the caller
 * needing to switch to a separate remove call.
 */
export const updateCartItemSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(0).max(MAX_CART_ITEM_QUANTITY),
});
export type UpdateCartItemInput = z.infer<typeof updateCartItemSchema>;

export const removeCartItemSchema = z.object({
  variantId: z.string().min(1),
});
export type RemoveCartItemInput = z.infer<typeof removeCartItemSchema>;

/** An empty string clears an already-applied coupon (`OrderSummaryPanelProps.onApplyCoupon`'s own documented convention) rather than needing a second "remove coupon" schema/action. */
export const applyCouponSchema = z.object({
  code: z.string().trim().max(40),
});
export type ApplyCouponInput = z.infer<typeof applyCouponSchema>;
