import type { ComponentType } from "react";
import Link from "next/link";
import {
  Boxes,
  Cpu,
  FileText,
  HelpCircle,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  ShoppingBag,
  Users,
  Wrench,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * AdminSidebar — docs/09-ADMIN-DAD-MODE.md §3 "Navigation": a grouped, short
 * top-level nav, ten items maximum, with a pinned "Help" row that is always
 * visible at the bottom (separate from the scrollable list). docs/05-
 * DESIGN-SYSTEM.md §3 "Layout": "Admin sidebar 256px fixed (desktop),
 * off-canvas sheet below `lg`"; §8: "256px sidebar (sheet below `lg`) + 80px
 * top bar + scroll area".
 *
 * This file exports the nav data (`AdminNavItem`, `DEFAULT_ADMIN_NAV_ITEMS`)
 * and the actual `<nav>` markup (`AdminSidebarContent`) separately from the
 * desktop-fixed `<aside>` wrapper (`AdminSidebar`) so `AdminShell` can reuse
 * the exact same content inside a `Sheet` for the `<lg` off-canvas rendering
 * without duplicating the nav markup — there is exactly one place the
 * desktop rail and the mobile sheet could drift out of sync.
 *
 * Not a Client Component: `activeHref` is accepted as a plain prop rather
 * than read via `usePathname()` — there is no App Router route tree wired
 * to these components yet (per the task brief), so this stays a plain,
 * server-renderable, presentational component. Wiring real routing/active
 * state is a later phase.
 *
 * Accessibility: every row is `min-h-12` (48px), the admin-specific target
 * in docs/09 §11 ("Touch targets 48×48 CSS px minimum") which overrides the
 * general 44×44 minimum in docs/05 §5 A9 because the primary persona is
 * over 50. The active row is never colour-only (docs/05 §1.5 / §5 A6): it
 * gets a tonal background AND a left accent border AND `aria-current="page"`.
 * `min-h-12` (not `h-12`) is used per docs/05 §5 A13 so OS text scaling up to
 * 200% can grow the row instead of clipping the label.
 */

export interface AdminNavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  badgeCount?: number;
}

/**
 * Illustrative default nav + badge counts straight from docs/09-ADMIN-DAD-
 * MODE.md §3's example (Orders 4, Stock 7, Repairs 2, Messages 3). These are
 * hardcoded placeholders — once order/stock/repair/message data is wired up
 * in a later phase, callers should pass real counts via `AdminSidebarProps.items`
 * instead of relying on this default export.
 */
export const DEFAULT_ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: "Today", href: "/admin", icon: LayoutDashboard },
  { label: "Orders", href: "/admin/orders", icon: ShoppingBag, badgeCount: 4 },
  { label: "Products", href: "/admin/products", icon: Package },
  { label: "Stock", href: "/admin/inventory", icon: Boxes, badgeCount: 7 },
  { label: "Customers", href: "/admin/customers", icon: Users },
  { label: "Repairs", href: "/admin/service", icon: Wrench, badgeCount: 2 },
  { label: "Messages", href: "/admin/enquiries", icon: MessageSquare, badgeCount: 3 },
  { label: "PC Builder", href: "/admin/pc-builder", icon: Cpu },
  { label: "Content", href: "/admin/content", icon: FileText },
  { label: "Settings", href: "/admin/settings", icon: Settings },
];

const HELP_ITEM: AdminNavItem = { label: "Help", href: "/admin/help", icon: HelpCircle };

const navRowClasses =
  "flex min-h-12 items-center gap-3 rounded px-3 text-body-md text-on-surface transition-colors border-l-2 border-transparent hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container";

const navRowActiveClasses = "bg-surface-container-high border-l-2 border-primary-container";

export interface AdminSidebarProps {
  items?: AdminNavItem[];
  activeHref?: string;
  className?: string;
}

/**
 * `/admin` itself is matched exactly (every other route also starts with
 * `/admin`, so a naive prefix match would light up "Today" everywhere).
 * Every other row prefix-matches so a sub-route like `/admin/products/new`
 * or `/admin/builder/rules` still highlights its parent row ("Products",
 * "PC Builder") even though the row's own `href` points at that section's
 * landing page, not every page under it.
 */
function isNavItemActive(itemHref: string, activeHref: string | undefined): boolean {
  if (!activeHref) return false;
  if (itemHref === "/admin") return activeHref === "/admin";
  return activeHref === itemHref || activeHref.startsWith(`${itemHref}/`);
}

/**
 * The actual nav markup, shared by the desktop `<aside>` (`AdminSidebar`
 * below) and the mobile `Sheet` composed in `AdminShell`.
 */
export function AdminSidebarContent({
  items = DEFAULT_ADMIN_NAV_ITEMS,
  activeHref,
  className,
}: AdminSidebarProps) {
  return (
    <nav aria-label="Admin" className={cn("flex h-full flex-col gap-4", className)}>
      <Link
        href="/admin"
        className="rounded px-3 text-body-lg font-medium text-on-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container"
      >
        City Computer Admin
      </Link>

      <ul className="flex flex-1 flex-col gap-1 overflow-y-auto">
        {items.map((item) => {
          const isActive = isNavItemActive(item.href, activeHref);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={cn(navRowClasses, isActive && navRowActiveClasses)}
              >
                <Icon className="size-5 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {typeof item.badgeCount === "number" && item.badgeCount > 0 && (
                  <Badge variant="danger">{item.badgeCount}</Badge>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <Separator />

      <Link
        href={HELP_ITEM.href}
        aria-current={isNavItemActive(HELP_ITEM.href, activeHref) ? "page" : undefined}
        className={cn(
          navRowClasses,
          isNavItemActive(HELP_ITEM.href, activeHref) && navRowActiveClasses,
        )}
      >
        <HELP_ITEM.icon className="size-5 shrink-0" />
        <span className="flex-1">{HELP_ITEM.label}</span>
      </Link>
    </nav>
  );
}

/**
 * Desktop-fixed rendering: 256px (`w-64`) rail, visible at `lg` and above.
 * The `<lg` off-canvas sheet rendering of the same `AdminSidebarContent`
 * lives in `AdminShell`, not here, so there is only one nav-markup source.
 */
export function AdminSidebar({ items, activeHref, className }: AdminSidebarProps) {
  return (
    <aside
      className={cn(
        "hidden lg:flex lg:w-64 lg:flex-col lg:border-r lg:border-glass-stroke lg:bg-obsidian-surface lg:p-4",
        className,
      )}
    >
      <AdminSidebarContent items={items} activeHref={activeHref} />
    </aside>
  );
}
