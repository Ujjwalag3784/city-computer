import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { ContentSubNav } from "@/components/admin/content-sub-nav";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listMenusForAdmin } from "@/server/services/admin/menus";
import { MenuSection } from "./_components/menu-section";
import { LinkChecker } from "./_components/link-checker";

export const metadata: Metadata = { title: "Menus — Admin — City Computer Systems" };

/** `/admin/menus` — docs/17 Phase 10: "menus editable in admin with a broken-link check." */
export default async function AdminMenusPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "menu:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/menus");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const menus = await listMenusForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <ContentSubNav active="menus" />
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Menus</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          What shows up in the site header, footer, and mobile menu. Items link to a real category,
          brand, or page — or a custom URL if nothing else fits.
        </p>
      </div>

      <LinkChecker />

      {menus.map((menu) => (
        <MenuSection key={menu.key} menuKey={menu.key} name={menu.name} items={menu.items} />
      ))}
    </div>
  );
}
