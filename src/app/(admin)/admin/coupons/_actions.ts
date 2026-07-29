"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { couponFormSchema, setCouponActiveSchema } from "@/lib/validation/admin/coupons";
import { createCoupon, updateCoupon, setCouponActive } from "@/server/services/admin/coupons";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const COUPONS_LIST_PATH = "/admin/coupons";

export async function createCouponAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(async () => {
    const parsed = couponFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("coupon:write");
    const created = await createCoupon(parsed.data, actor);

    revalidatePath(COUPONS_LIST_PATH);
    return created;
  });
}

export async function updateCouponAction(
  couponId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = couponFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("coupon:write");
    await updateCoupon(couponId, parsed.data, actor);

    revalidatePath(COUPONS_LIST_PATH);
    revalidatePath(`${COUPONS_LIST_PATH}/${couponId}`);
  });
}

export async function setCouponActiveAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = setCouponActiveSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("coupon:write");
    await setCouponActive(parsed.data.couponId, parsed.data.isActive, actor);

    revalidatePath(COUPONS_LIST_PATH);
  });
}
