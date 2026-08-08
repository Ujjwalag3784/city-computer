"use client";

import type { ReactNode } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { MobileNav } from "@/components/layout/mobile-nav";
import { SiteFooter } from "@/components/layout/site-footer";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/layout/breadcrumbs";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { CookieConsent } from "@/components/layout/cookie-consent";
import { AdminSidebar, DEFAULT_ADMIN_NAV_ITEMS } from "@/components/admin/admin-sidebar";
import { AdminTopBar } from "@/components/admin/admin-topbar";
import { cn } from "@/lib/utils";

/**
 * LayoutSection — `/design` showcase for docs/05-DESIGN-SYSTEM.md §6
 * "Layout (D)" inventory (`SiteHeader`, `MobileNav`, `SiteFooter`,
 * `AnnouncementBar`, `Breadcrumbs`, `LocaleSwitcher`, `CookieConsent`,
 * `AdminSidebar`, `AdminTopBar`), plus the §10 definition-of-done rule this
 * whole `/design` route exists to satisfy: "no hardcoded colour, radius, or
 * font value." Every wrapper class below is an existing Tailwind
 * utility/token — nothing here introduces a raw hex/px value.
 *
 * `AdminShell` is deliberately NOT rendered here even though it appears in
 * the same §6 inventory row: it composes `AdminSidebar` + `AdminTopBar` +
 * its own `min-h-screen` flex frame and expects to *be* the page viewport.
 * Nesting that inside this showcase page's own layout would fight this
 * page's scroll container and double up the "skip to content" link for no
 * benefit — its two constituent pieces are demoed individually below
 * instead, which covers the same rendered chrome.
 *
 * Client boundary: `MobileNav`, `AnnouncementBar`, `CookieConsent`,
 * `SiteFooter`, `LocaleSwitcher`, and `AdminTopBar` are all Client Components
 * in their own right (local state, `localStorage`, `window` listeners, a
 * Radix `Sheet`/`Dialog`/`DropdownMenu`). Composing all of them on one page
 * is simplest with a single `"use client"` boundary at this file's top
 * rather than several nested client islands.
 *
 * Radix portals: `MobileNav`'s `Sheet`, `CookieConsent`'s "Choose" `Dialog`,
 * `LocaleSwitcher`'s and `AdminTopBar`'s `DropdownMenu`, and `AdminTopBar`'s
 * ⌘K `CommandDialog` all render their open content into `document.body` via
 * a Radix `Portal`, regardless of the bounded preview box below — that is
 * normal, expected Radix behaviour, not something this showcase file can or
 * should override.
 */

const DEMO_BREADCRUMB_ITEMS: BreadcrumbItem[] = [
  { label: "Laptops", href: "/c/laptops" },
  { label: "Gaming laptops", href: "/c/laptops/gaming" },
  { label: "ROG Strix G16" },
];

interface PreviewBoxProps {
  /** Name shown above the box. */
  title: string;
  children: ReactNode;
  /** Extra classes, e.g. a fixed height (`h-96`) for scroll-sensitive demos. */
  className?: string;
  /**
   * Render children edge-to-edge (no inner padding) — for components that
   * are themselves full-width chrome (`SiteHeader`, `SiteFooter`,
   * `AnnouncementBar`, `CookieConsent`, `AdminSidebar`, `AdminTopBar`).
   * Defaults to `false` (padded), for components meant to sit inline within
   * a page's content column.
   */
  bleed?: boolean;
}

/**
 * Bounded, labelled preview frame shared by every demo below.
 *
 * - `relative` + `isolate` give any `position: absolute` descendant a local
 *   containing block and stacking context.
 * - `contain-layout` additionally gives `position: fixed` descendants (e.g.
 *   `CookieConsent`'s banner) a containing block scoped to this box instead
 *   of the real viewport, so a fixed child lands at this box's edges, not
 *   the browser window's.
 * - `overflow-y-auto` turns this box into the nearest scrolling ancestor for
 *   `position: sticky` descendants (e.g. `SiteHeader`), so "sticky" means
 *   "sticks while this box scrolls," not "sticks to the real page."
 *
 * All three are ordinary Tailwind utilities, not raw values.
 */
function PreviewBox({ title, children, className, bleed = false }: PreviewBoxProps) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-title text-on-surface">{title}</h3>
      <div
        className={cn(
          "relative isolate contain-layout overflow-y-auto rounded-xl border border-glass-stroke bg-surface",
          className,
        )}
      >
        {bleed ? children : <div className="p-6">{children}</div>}
      </div>
    </div>
  );
}

export function LayoutSection() {
  return (
    <section className="flex flex-col gap-10">
      <div className="flex flex-col gap-2">
        <h2 className="text-headline-md text-on-surface">Layout</h2>
        <p className="text-body-sm text-on-surface-variant">
          docs/05-DESIGN-SYSTEM.md §6 &quot;Layout (D)&quot; — storefront chrome and the two
          admin-shell pieces that are structurally layout (see the file header comment for why
          `AdminShell` itself is excluded).
        </p>
      </div>

      <PreviewBox title="SiteHeader — variant: full" bleed className="h-96">
        <SiteHeader variant="full" wishlistCount={2} cartCount={3} />
        <div className="flex flex-col gap-4 p-6">
          <p className="text-body-sm text-on-surface-variant">
            Scroll this box — the header stays pinned via `position: sticky`, contained to this
            preview by the box&apos;s own scrolling, not the real page.
          </p>
          <div className="h-32 rounded-lg bg-surface-container-low" />
          <div className="h-32 rounded-lg bg-surface-container-low" />
          <div className="h-32 rounded-lg bg-surface-container-low" />
        </div>
      </PreviewBox>

      <PreviewBox title="SiteHeader — variant: with-search" bleed>
        <SiteHeader variant="with-search" cartCount={1} />
      </PreviewBox>

      <PreviewBox title="SiteHeader — variant: minimal" bleed>
        <SiteHeader
          variant="minimal"
          minimalActions={
            <span className="text-body-sm text-on-surface-variant">Secure checkout</span>
          }
        />
      </PreviewBox>

      <PreviewBox title="MobileNav">
        {/* Renders DEFAULT_NAV_ITEMS (its own default) — the same array SiteHeader's desktop
            nav defaults to, so the two never drift apart. Opens as a Radix Sheet portaled to
            document.body; click the trigger to see the full-viewport panel. */}
        <MobileNav />
      </PreviewBox>

      <PreviewBox title="SiteFooter" bleed>
        <SiteFooter />
      </PreviewBox>

      <PreviewBox title="AnnouncementBar" bleed>
        <AnnouncementBar
          message="Free delivery inside Kathmandu Valley on orders over Rs. 5,000."
          href="/shop?sort=-discount&onSale=true"
          linkLabel="Shop deals"
        />
      </PreviewBox>

      <PreviewBox title="Breadcrumbs">
        <Breadcrumbs items={DEMO_BREADCRUMB_ITEMS} />
      </PreviewBox>

      <PreviewBox title="LocaleSwitcher">
        {/* No onLocaleChange — there is no i18n-aware router wired up yet (see the component's
            own doc comment), and omitting the handler is the documented, fully-demoable way to
            render it: the menu still opens/closes and tracks currentLocale, it just doesn't
            navigate anywhere. */}
        <LocaleSwitcher currentLocale="en" />
      </PreviewBox>

      <PreviewBox title="CookieConsent" bleed className="h-56">
        {/* Manages its own visibility via localStorage ("cc-cookie-consent"): it only shows the
            banner when that key is missing, unparsable, or older than 12 months. On a repeat
            view in a browser that already has a stored (still-current) consent, this renders
            nothing here — that is the component working as designed, not a showcase bug. Clear
            that localStorage key and reload to see the banner again. */}
        <CookieConsent />
      </PreviewBox>

      <PreviewBox title="AdminSidebar" bleed className="h-96">
        {/* AdminSidebar's own root is `hidden` below the `lg` breakpoint by design — the sub-lg
            off-canvas Sheet rendering of this same nav content is AdminShell's responsibility,
            not this component's, so nothing renders here on a narrow viewport. Reusing the
            exported DEFAULT_ADMIN_NAV_ITEMS rather than inventing a parallel nav array, with
            activeHref pointed at "Orders" to demonstrate the active row (tonal background + left
            accent border + aria-current, never colour alone) alongside its badge count. */}
        <AdminSidebar items={DEFAULT_ADMIN_NAV_ITEMS} activeHref="/admin/orders" />
      </PreviewBox>

      <PreviewBox title="AdminTopBar" bleed>
        {/* onMobileMenuClick is intentionally omitted: there is no owning AdminShell instance
            here to hold mobile-sidebar-open state, so the (lg:hidden) hamburger is a no-op in
            this isolated preview. */}
        <AdminTopBar userName="Rajesh Shrestha" />
      </PreviewBox>
    </section>
  );
}
