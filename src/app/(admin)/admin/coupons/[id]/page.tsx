import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/lib/errors";
import { paisaToRupees } from "@/lib/money";
import { CouponType } from "@/generated/prisma/client";
import { getCouponForAdmin } from "@/server/services/admin/coupons";
import { CouponForm, type CouponFormValues } from "../_components/coupon-form";

export const metadata: Metadata = { title: "Edit discount code — Admin — City Computer Systems" };

interface EditCouponPageProps {
  params: Promise<{ id: string }>;
}

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export default async function EditCouponPage({ params }: EditCouponPageProps) {
  const { id } = await params;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "coupon:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect(`/auth/login?callbackUrl=/admin/coupons/${id}`);
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  let coupon;
  try {
    coupon = await getCouponForAdmin(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const initialValues: CouponFormValues = {
    code: coupon.code,
    description: coupon.description ?? "",
    type: coupon.type,
    value: coupon.type === CouponType.FIXED_AMOUNT ? paisaToRupees(coupon.value) : coupon.value,
    minOrderRupees: coupon.minOrderPaisa !== null ? paisaToRupees(coupon.minOrderPaisa) : "",
    maxDiscountRupees:
      coupon.maxDiscountPaisa !== null ? paisaToRupees(coupon.maxDiscountPaisa) : "",
    usageLimit: coupon.usageLimit ?? "",
    usageLimitPerCustomer: coupon.usageLimitPerCustomer ?? "",
    startsAt: toDateInputValue(coupon.startsAt),
    endsAt: toDateInputValue(coupon.endsAt),
    appliesTo: coupon.appliesTo,
    targetIdsText: coupon.targetIds.join(", "),
    excludeDiscounted: coupon.excludeDiscounted,
    firstOrderOnly: coupon.firstOrderOnly,
    isActive: coupon.isActive,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Edit {coupon.code}</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          {coupon.usedCount > 0
            ? `Used ${coupon.usedCount} time${coupon.usedCount === 1 ? "" : "s"} so far.`
            : "Not used yet."}
        </p>
      </div>
      <CouponForm couponId={coupon.id} initialValues={initialValues} />
    </div>
  );
}
