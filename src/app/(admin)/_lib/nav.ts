/**
 * The `(admin)` route group's own "glue" file — the `app/[locale]/
 * (storefront)/_lib/catalog-view.ts` pattern applied to admin: the one
 * place that is allowed to know about both `server/services/admin/
 * dashboard.ts`'s counts and `components/admin/admin-sidebar.tsx`'s
 * plain `AdminNavItem` props, translating between them per docs/04 §3's
 * "`components/` never imports `server/**`" boundary.
 *
 * Route-private (`_lib/`, not promoted to `components/` or `server/`):
 * this mapping only exists to build `(admin)/layout.tsx`'s nav, nothing
 * else in the app needs it.
 *
 * `icon` is built with `createElement` (not JSX — this is a `.ts`, not a
 * `.tsx`, file) rather than stored as the bare `lucide-react` component
 * reference. `(admin)/layout.tsx` is a Server Component and `AdminShell`
 * is `"use client"`; a `forwardRef` component object crossing that
 * boundary as prop data fails at request time with "Functions cannot be
 * passed directly to Client Components" (React can serialise a rendered
 * *element*, never the component function itself). Rendering the icon
 * here, before it crosses, is the fix — see `admin-sidebar.tsx`'s
 * `AdminNavItem.icon` doc comment for the client side of this.
 */
import "server-only";
import { createElement } from "react";
import {
  Boxes,
  Cpu,
  FileText,
  LayoutDashboard,
  MessageSquare,
  Package,
  Settings,
  ShoppingBag,
  Users,
  Wrench,
} from "lucide-react";
import type { AdminNavItem } from "@/components/admin/admin-sidebar";
import type { TodayDashboardData } from "@/server/services/admin/dashboard";
import { isAdminRoleKey, type AdminRoleKey } from "@/server/auth/permissions";

const ICON_CLASS = "size-5 shrink-0";

/**
 * docs/09-ADMIN-DAD-MODE.md §3's module map lists per-*route* access
 * (e.g. `/admin/orders` is OWNER/MANAGER/STAFF/SUPPORT, `/admin/builder/
 * rules` is OWNER/TECHNICIAN only even though `/admin/builder/parts` also
 * allows MANAGER). The sidebar's ten grouped nav rows are coarser than
 * that — one row often fans out to several routes with different role
 * lists. Each row below is gated on the UNION of every route it contains,
 * so a role that can reach *any* page under that row still sees the row;
 * the finer per-route check still happens on the destination page itself
 * (or will, once that page exists) via `requirePermission`/`requireAdminSession`.
 * This union-based grouping is a JUDGMENT CALL, not a literal reading of
 * §3's table, and should be revisited if a role ever needs to be
 * conspicuously denied an entire row rather than just its narrower pages.
 */
const NAV_DEFINITIONS: {
  key: string;
  label: string;
  href: string;
  icon: AdminNavItem["icon"];
  allowedRoles: readonly AdminRoleKey[];
}[] = [
  {
    key: "today",
    label: "Today",
    href: "/admin",
    icon: createElement(LayoutDashboard, { className: ICON_CLASS }),
    // §3: "All staff."
    allowedRoles: ["OWNER", "MANAGER", "STAFF", "CONTENT_EDITOR", "SUPPORT", "TECHNICIAN"],
  },
  {
    key: "orders",
    label: "Orders",
    href: "/admin/orders",
    icon: createElement(ShoppingBag, { className: ICON_CLASS }),
    allowedRoles: ["OWNER", "MANAGER", "STAFF", "SUPPORT"],
  },
  {
    key: "products",
    label: "Products",
    href: "/admin/products",
    icon: createElement(Package, { className: ICON_CLASS }),
    // STAFF can view but "no price edit" — still shown the row; the
    // product list/wizard pages enforce the finer no-price-edit rule.
    allowedRoles: ["OWNER", "MANAGER", "STAFF"],
  },
  {
    key: "stock",
    label: "Stock",
    href: "/admin/inventory",
    icon: createElement(Boxes, { className: ICON_CLASS }),
    allowedRoles: ["OWNER", "MANAGER", "STAFF"],
  },
  {
    key: "customers",
    label: "Customers",
    href: "/admin/customers",
    icon: createElement(Users, { className: ICON_CLASS }),
    allowedRoles: ["OWNER", "MANAGER", "SUPPORT"],
  },
  {
    key: "repairs",
    label: "Repairs",
    href: "/admin/service",
    icon: createElement(Wrench, { className: ICON_CLASS }),
    allowedRoles: ["OWNER", "MANAGER", "TECHNICIAN", "STAFF"],
  },
  {
    key: "messages",
    label: "Messages",
    href: "/admin/enquiries",
    icon: createElement(MessageSquare, { className: ICON_CLASS }),
    allowedRoles: ["OWNER", "MANAGER", "SUPPORT"],
  },
  {
    key: "pc-builder",
    label: "PC Builder",
    href: "/admin/builder/parts",
    icon: createElement(Cpu, { className: ICON_CLASS }),
    // Union of `/admin/builder/parts` (+TECHNICIAN), `/admin/builder/rules`
    // (OWNER+TECHNICIAN only), `/admin/builder/builds` (OWNER+MANAGER).
    allowedRoles: ["OWNER", "MANAGER", "TECHNICIAN"],
  },
  {
    key: "content",
    label: "Content",
    href: "/admin/blog",
    icon: createElement(FileText, { className: ICON_CLASS }),
    // Union of blog/pages (+CONTENT_EDITOR), media (+CONTENT_EDITOR),
    // categories/brands/coupons/campaigns/reviews (OWNER+MANAGER only).
    allowedRoles: ["OWNER", "MANAGER", "CONTENT_EDITOR"],
  },
  {
    key: "settings",
    label: "Settings",
    href: "/admin/settings",
    icon: createElement(Settings, { className: ICON_CLASS }),
    // §3: `/admin/settings/*`, `/admin/users`, `/admin/branches`,
    // `/admin/activity` are all OWNER only. `/admin/reports` (OWNER+
    // MANAGER) is reachable from within Settings for a MANAGER even
    // though the row's own destination page is OWNER-only — narrower
    // than the row it sits in, same "gate is the earlier lower bound"
    // pattern as `products`/`repairs` above.
    allowedRoles: ["OWNER", "MANAGER"],
  },
];

export interface AdminNavBadgeCounts {
  orders?: number;
  stock?: number;
  repairs?: number;
  messages?: number;
}

/** Maps `TodayDashboardData`'s task counts onto the four nav rows docs/09 §3's mock actually shows a badge for ("Orders ● 4", "Stock ● 7", "Repairs ● 2", "Messages ● 3"). */
export function badgeCountsFromDashboard(dashboard: TodayDashboardData): AdminNavBadgeCounts {
  const byId = new Map(dashboard.tasks.map((task) => [task.id, task.count]));
  return {
    orders: (byId.get("bank-transfers") ?? 0) + (byId.get("paid-not-sent") ?? 0),
    stock: byId.get("low-stock") ?? 0,
    repairs: byId.get("ready-for-pickup") ?? 0,
    messages: byId.get("unread-messages") ?? 0,
  };
}

const BADGE_BY_NAV_KEY: Record<string, keyof AdminNavBadgeCounts> = {
  orders: "orders",
  stock: "stock",
  repairs: "repairs",
  messages: "messages",
};

/**
 * Builds the exact `AdminNavItem[]` `AdminShell` renders, filtered to
 * whatever the session's roles can reach (docs/09 §8: "Actions they lack
 * permission for are not rendered at all — never shown-then-denied", the
 * same principle applied to nav rows, not just buttons) and carrying live
 * badge counts instead of `admin-sidebar.tsx`'s hardcoded illustrative
 * defaults.
 */
export function buildAdminNavItems(
  roleKeys: readonly string[],
  badgeCounts: AdminNavBadgeCounts = {},
): AdminNavItem[] {
  const adminRoleKeys = roleKeys.filter(isAdminRoleKey);

  return NAV_DEFINITIONS.filter((definition) =>
    definition.allowedRoles.some((role) => adminRoleKeys.includes(role)),
  ).map((definition) => {
    const badgeField = BADGE_BY_NAV_KEY[definition.key];
    // `badgeField` is drawn from `BADGE_BY_NAV_KEY`'s own fixed value set
    // (a `keyof AdminNavBadgeCounts`), never arbitrary input — same
    // "closed lookup, not user input" justification as `lib/errors.ts`'s
    // `STATUS_BY_CODE[code]`.
    // eslint-disable-next-line security/detect-object-injection
    const badgeCount = badgeField ? badgeCounts[badgeField] : undefined;
    return {
      label: definition.label,
      href: definition.href,
      icon: definition.icon,
      ...(typeof badgeCount === "number" && badgeCount > 0 ? { badgeCount } : {}),
    };
  });
}
