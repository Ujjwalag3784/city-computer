import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listCategoriesForAdmin } from "@/server/services/admin/category";
import { CategoryTree } from "./_components/category-tree";

export const metadata: Metadata = {
  title: "Categories — Admin — City Computer Systems",
};

/**
 * `/admin/categories` — docs/09-ADMIN-DAD-MODE.md §3's "Categories"
 * module (OWNER, MANAGER only). `(admin)/layout.tsx` only checks "is
 * this session an admin at all" — the finer `category:write` capability
 * check happens here, page-by-page, same as every Server Action in
 * `_actions.ts` re-checks it independently (docs/07-API-DESIGN.md §4.4:
 * a page and a Server Action calling the same service must not diverge
 * on who's allowed). A STAFF session that types this URL directly gets
 * the same 404 the sidebar link never showing them in the first place
 * implies — never a read-only preview of a screen they can't act on.
 */
export default async function AdminCategoriesPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "category:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect("/auth/login?callbackUrl=/admin/categories");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const tree = await listCategoriesForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Categories</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          This is where you organise the categories customers browse by. Drag a category up or down
          to change the order it appears in on the website.
        </p>
      </div>

      <CategoryTree tree={tree} />
    </div>
  );
}
