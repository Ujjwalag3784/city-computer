import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { BranchForm, EMPTY_BRANCH_FORM } from "../_components/branch-form";

export const metadata: Metadata = { title: "Add a store — Admin — City Computer Systems" };

export default async function NewBranchPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "branch:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect("/auth/login?callbackUrl=/admin/branches/new");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Add a store</h1>
      </div>
      <BranchForm initialValues={EMPTY_BRANCH_FORM} />
    </div>
  );
}
