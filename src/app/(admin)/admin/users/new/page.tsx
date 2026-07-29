import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { STAFF_ROLE_KEYS } from "@/lib/validation/admin/staff";
import { STAFF_ROLE_DESCRIPTIONS } from "@/server/services/admin/staff";
import { NewStaffForm } from "../_components/new-staff-form";

export const metadata: Metadata = { title: "Add a staff member — Admin — City Computer Systems" };

export default async function NewStaffPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "user:manage");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/users/new");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const roles = STAFF_ROLE_KEYS.map((key) => ({
    key,
    // eslint-disable-next-line security/detect-object-injection -- `key` is drawn from `STAFF_ROLE_KEYS` itself, never arbitrary input.
    ...STAFF_ROLE_DESCRIPTIONS[key],
  }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Add a staff member</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          They&apos;ll be able to sign in once you give them the temporary password shown after
          this.
        </p>
      </div>
      <NewStaffForm roles={roles} />
    </div>
  );
}
