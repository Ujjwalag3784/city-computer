/**
 * `/admin/coupons` — docs/09-ADMIN-DAD-MODE.md §3 ("Discount codes" —
 * OWNER, MANAGER) and §2.1's vocabulary table has no override for
 * "coupon" itself, so the admin UI keeps calling it what docs/09's own
 * module map calls it: "Discount codes". Field shapes mirror
 * `Coupon`/`prisma/schema/commerce.prisma` directly — `value` is paisa
 * for FIXED_AMOUNT, whole percentage points (0-100) for PERCENTAGE, per
 * that model's own doc comment.
 */
import { z } from "zod";
import { CouponType, CouponAppliesTo } from "@/generated/prisma/client";

export const adminCouponListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  filter: z.enum(["all", "active", "inactive", "expired"]).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});
export type AdminCouponListQuery = z.infer<typeof adminCouponListQuerySchema>;

export const couponFormSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(3, "Use at least 3 characters.")
      .max(30)
      .regex(/^[A-Za-z0-9-]+$/, "Letters, numbers, and hyphens only."),
    description: z.string().trim().max(200).optional(),
    type: z.nativeEnum(CouponType),
    /** Percentage points for PERCENTAGE, whole rupees for FIXED_AMOUNT (converted to paisa in the service) — 0 and ignored for FREE_SHIPPING. */
    value: z.coerce.number().int().min(0).default(0),
    minOrderRupees: z.coerce.number().int().min(0).optional(),
    maxDiscountRupees: z.coerce.number().int().min(0).optional(),
    usageLimit: z.coerce.number().int().min(1).optional(),
    usageLimitPerCustomer: z.coerce.number().int().min(1).optional(),
    startsAt: z.string().optional(),
    endsAt: z.string().optional(),
    appliesTo: z.nativeEnum(CouponAppliesTo).default(CouponAppliesTo.ALL),
    targetIds: z.array(z.string()).default([]),
    excludeDiscounted: z.boolean().default(false),
    firstOrderOnly: z.boolean().default(false),
    isActive: z.boolean().default(true),
  })
  .refine((data) => data.type !== CouponType.PERCENTAGE || (data.value >= 1 && data.value <= 100), {
    message: "A percentage discount needs to be between 1 and 100.",
    path: ["value"],
  })
  .refine((data) => data.type !== CouponType.FIXED_AMOUNT || data.value >= 1, {
    message: "Enter how many rupees this coupon takes off.",
    path: ["value"],
  })
  .refine((data) => data.appliesTo === CouponAppliesTo.ALL || data.targetIds.length > 0, {
    message: "Choose at least one product, brand, or category.",
    path: ["targetIds"],
  });
export type CouponFormInput = z.infer<typeof couponFormSchema>;

export const setCouponActiveSchema = z.object({
  couponId: z.string().min(1),
  isActive: z.boolean(),
});
