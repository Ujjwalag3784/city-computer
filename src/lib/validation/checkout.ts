/**
 * Checkout input validation — docs/17-ROADMAP-PHASES.md Phase 7's
 * three-step checkout (address, payment method, review). Flat under
 * `lib/validation/`, matching `cart.ts`'s precedent (storefront-facing,
 * not admin-only).
 */
import { z } from "zod";
import { NEPAL_PROVINCES, isValidNepalPhone, isValidWard } from "@/lib/nepal";

export const checkoutAddressSchema = z.object({
  fullName: z.string().trim().min(1, "Full name is required.").max(100),
  phone: z.string().refine(isValidNepalPhone, "Enter a valid Nepali mobile number."),
  alternatePhone: z
    .string()
    .refine(
      (value) => value === "" || isValidNepalPhone(value),
      "Enter a valid Nepali mobile number.",
    )
    .optional(),
  province: z.enum(NEPAL_PROVINCES),
  district: z.string().trim().min(1, "District is required.").max(60),
  municipality: z.string().trim().min(1, "Municipality/city is required.").max(100),
  ward: z.number().int().refine(isValidWard, "Enter a ward number between 1 and 35.").optional(),
  streetAddress: z.string().trim().min(1, "Street address is required.").max(200),
  landmark: z.string().trim().max(200).optional(),
});
export type CheckoutAddressInput = z.infer<typeof checkoutAddressSchema>;

/** Step 1's "what would this cost" preview, resolved before the shopper commits to an address on file — same shape the actual order placement re-derives independently server-side, never trusting this quote's numbers back from the client. */
export const checkoutQuoteSchema = z.object({
  district: z.string().trim().min(1),
  fulfilmentType: z.enum(["DELIVERY", "PICKUP"]),
});
export type CheckoutQuoteInput = z.infer<typeof checkoutQuoteSchema>;

export const placeOrderSchema = z
  .object({
    shippingAddress: checkoutAddressSchema,
    billingSameAsShipping: z.boolean(),
    billingAddress: checkoutAddressSchema.optional(),
    fulfilmentType: z.enum(["DELIVERY", "PICKUP"]),
    /** Required when `fulfilmentType` is `PICKUP` — which branch the order is collected from. */
    branchId: z.string().optional(),
    paymentMethod: z.enum(["COD", "BANK_TRANSFER"]),
    couponCode: z.string().trim().max(40).optional(),
    customerNote: z.string().trim().max(500).optional(),
  })
  .refine((input) => input.billingSameAsShipping || input.billingAddress !== undefined, {
    message: "Provide a billing address, or mark it the same as the shipping address.",
    path: ["billingAddress"],
  })
  .refine((input) => input.fulfilmentType !== "PICKUP" || Boolean(input.branchId), {
    message: "Pick which branch you'll collect this from.",
    path: ["branchId"],
  });
export type PlaceOrderInput = z.infer<typeof placeOrderSchema>;
