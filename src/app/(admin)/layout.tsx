import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/admin-shell";
import { auth } from "@/server/auth";
import { requireAdminSession } from "@/server/auth/guards";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { getTodayDashboardForRequest } from "@/server/services/admin/dashboard";
import { badgeCountsFromDashboard, buildAdminNavItems } from "./_lib/nav";
import { globalAdminSearchAction } from "./_actions";

/**
 * `(admin)/layout.tsx` — docs/04-REPOSITORY-STRUCTURE.md: "role guard,
 * AdminShell, noindex header." A sibling of `[locale]/`, not nested
 * inside it (admin is not localized). `middleware.ts`'s `adminMiddleware`
 * already gates every `/admin/*` request before any route code runs
 * (docs/13-SECURITY.md §3) — the `requireAdminSession` call below is
 * deliberate defense-in-depth, not the primary gate, and mirrors
 * middleware's own fail-closed behaviour (unauthenticated → sign-in
 * redirect, wrong role → 404, never a friendlier "you can't be here"
 * page that would confirm the area exists to someone probing it).
 *
 * `noindex`: `metadata.robots` below, since this entire route group must
 * never appear in search results.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  try {
    await requireAdminSession(session);
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect("/auth/login?callbackUrl=/admin");
    }
    if (error instanceof ForbiddenError) {
      notFound();
    }
    throw error;
  }

  // `redirect`/`notFound` above throw (Next.js's control-flow signal), so
  // reaching this line means `requireAdminSession` returned successfully
  // and `session` is non-null — TypeScript can't see that narrowing across
  // the try/catch, hence the explicit assertion rather than a duplicate
  // runtime check.
  const activeSession = session!;

  const dashboard = await getTodayDashboardForRequest();
  const navItems = buildAdminNavItems(
    activeSession.user.roleKeys,
    badgeCountsFromDashboard(dashboard),
  );

  return (
    <AdminShell navItems={navItems} onSearch={globalAdminSearchAction}>
      {children}
    </AdminShell>
  );
}
