import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CookieConsent } from "@/components/layout/cookie-consent";
import { PRIMARY_NAV_ITEMS } from "@/config/navigation";

/**
 * docs/04-REPOSITORY-STRUCTURE.md: `(storefront)/layout.tsx` — "SiteHeader
 * + SiteFooter + CartDrawer." `CartDrawer` is deliberately not rendered
 * here yet: it needs live cart state (docs/04's `stores/cart-store.ts`,
 * Zustand), which doesn't exist until Phase 6 ("Cart & Inventory"). The
 * closest existing component, `MiniCartDrawer`
 * (`components/commerce/mini-cart-drawer.tsx`), is presentational-only
 * (built in Phase 2 against mock data) and wiring it to nothing would be
 * worse than not rendering it at all — flagged rather than faked.
 *
 * Every storefront page renders inside `<main id="main-content">` here,
 * once — `SiteHeader`'s skip-link (docs/05 §5 A11) targets that id, so
 * every page under this layout automatically gets a working skip-to-
 * content link without repeating the `<main>` wrapper per page.
 */
export default function StorefrontLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AnnouncementBar
        message="Free delivery inside Kathmandu Valley on orders over Rs. 5,000."
        href="/pages/warranty"
        linkLabel="Learn more"
      />
      <SiteHeader variant="with-search" navItems={PRIMARY_NAV_ITEMS} />

      <main id="main-content">{children}</main>

      <SiteFooter />
      <CookieConsent />
    </>
  );
}
