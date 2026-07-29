import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/lib/errors";
import { Province } from "@/generated/prisma/client";
import { getBranchForAdmin } from "@/server/services/admin/branches";
import { BranchForm, type BranchFormValues } from "../_components/branch-form";

export const metadata: Metadata = { title: "Edit store — Admin — City Computer Systems" };

interface EditBranchPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditBranchPage({ params }: EditBranchPageProps) {
  const { id } = await params;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "branch:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect(`/auth/login?callbackUrl=/admin/branches/${id}`);
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  let branch;
  try {
    branch = await getBranchForAdmin(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const initialValues: BranchFormValues = {
    name: branch.name,
    addressLine: branch.addressLine,
    district: branch.district,
    province: branch.province as Province,
    phone: branch.phone,
    email: branch.email ?? "",
    isPickupEnabled: branch.isPickupEnabled,
    isDefaultFulfilment: branch.isDefaultFulfilment,
    isActive: branch.isActive,
    hours: branch.hours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      isClosed: h.isClosed,
      openTime: h.openTime ?? "10:00",
      closeTime: h.closeTime ?? "19:00",
    })),
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Edit {branch.name}</h1>
      </div>
      <BranchForm branchId={branch.id} initialValues={initialValues} />
    </div>
  );
}
