import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listBrandsForAdmin } from "@/server/services/admin/brand";
import { BrandTable } from "./_components/brand-table";

export const metadata: Metadata = {
  title: "Brands — Admin — City Computer Systems",
};

/** `/admin/brands` — docs/09-ADMIN-DAD-MODE.md §3's "Brands" module (OWNER, MANAGER only). Same page-level permission re-check rationale as `admin/categories/page.tsx`'s doc comment. */
export default async function AdminBrandsPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "brand:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/brands");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const brands = await listBrandsForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Brands</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          This is where you manage the brands your products belong to.
        </p>
      </div>

      <BrandTable brands={brands} />
    </div>
  );
}
