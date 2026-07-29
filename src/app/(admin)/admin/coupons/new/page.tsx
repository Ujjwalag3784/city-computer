import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { CouponForm, EMPTY_COUPON_FORM } from "../_components/coupon-form";

export const metadata: Metadata = { title: "Add a discount code — Admin — City Computer Systems" };

export default async function NewCouponPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "coupon:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect("/auth/login?callbackUrl=/admin/coupons/new");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Add a discount code</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Create a code customers can type at checkout for money off their order.
        </p>
      </div>
      <CouponForm initialValues={EMPTY_COUPON_FORM} />
    </div>
  );
}
