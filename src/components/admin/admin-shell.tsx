"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AdminSidebar,
  AdminSidebarContent,
  type AdminNavItem,
} from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-topbar";
import { cn } from "@/lib/utils";

/**
 * AdminShell — the top-level admin layout: docs/05-DESIGN-SYSTEM.md §3
 * "Layout": "Admin sidebar 256px fixed (desktop), off-canvas sheet below
 * `lg`"; §8: "256px sidebar (sheet below `lg`) + 80px top bar + scroll
 * area". Composes `AdminSidebar` (desktop rail) + `AdminTopBar` + a
 * scrollable `<main>` for `children`, plus a `Sheet`-based off-canvas
 * rendering of the exact same nav content (`AdminSidebarContent`) for
 * viewports below `lg`, per docs/09-ADMIN-DAD-MODE.md §11 ("the sidebar
 * becomes a sheet below `lg` and admin must be fully usable on a phone").
 *
 * Must be a Client Component: it owns the mobile sidebar's open/closed
 * state, toggled by `AdminTopBar`'s hamburger button.
 *
 * Accessibility: a skip-to-content link is the first element rendered,
 * targeting `#main-content` on the `<main>` below (docs/05 §5 A11), mirroring
 * the storefront `SiteHeader`'s skip-link pattern. The mobile sheet's
 * `SheetTitle` ("Navigation") is visually `sr-only` here — the sheet already
 * shows the "City Computer Admin" wordmark and nav rows, so a second visible
 * heading would be redundant; the title still exists (not omitted) so Radix
 * has an accessible name for the dialog (docs/05 §5 A11-adjacent "every
 * dialog needs a name" rule, same as `MobileNav`'s `SheetTitle`).
 *
 * `activeHref` is optional: `(admin)/layout.tsx` (a Server Component, one
 * level up) has no `usePathname()` of its own to hand down, so when the
 * prop is omitted this falls back to reading the live pathname itself —
 * admin is not localized (docs/04 §3), so this is the plain `next/
 * navigation` hook, not the locale-aware wrapper storefront components use.
 * A caller that already knows the active route (e.g. a test) can still
 * override it explicitly.
 */

export interface AdminShellProps {
  children: ReactNode;
  navItems?: AdminNavItem[];
  activeHref?: string;
}

export function AdminShell({ children, navItems, activeHref }: AdminShellProps) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const pathname = usePathname();
  const resolvedActiveHref = activeHref ?? pathname ?? undefined;

  return (
    <div className="flex min-h-screen">
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only",
          "focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-body-sm focus:font-medium focus:text-on-primary",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        )}
      >
        Skip to content
      </a>

      <AdminSidebar items={navItems} activeHref={resolvedActiveHref} />

      <div className="flex min-h-screen flex-1 flex-col">
        <AdminTopBar onMobileMenuClick={() => setMobileSidebarOpen(true)} />
        <main id="main-content" className="flex-1 overflow-y-auto bg-background p-4 lg:p-6">
          {children}
        </main>
      </div>

      <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
        <SheetContent side="left" className="lg:hidden">
          <SheetHeader className="sr-only">
            <SheetTitle>Navigation</SheetTitle>
          </SheetHeader>
          <AdminSidebarContent items={navItems} activeHref={resolvedActiveHref} />
        </SheetContent>
      </Sheet>
    </div>
  );
}
