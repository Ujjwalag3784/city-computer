import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CookieConsent } from "@/components/layout/cookie-consent";
import { CartDrawerHost } from "@/components/commerce/cart-drawer-host";
import { PRIMARY_NAV_ITEMS } from "@/config/navigation";

/**
 * docs/04-REPOSITORY-STRUCTURE.md: `(storefront)/layout.tsx` — "SiteHeader
 * + SiteFooter + CartDrawer." As of docs/17 Phase 6, `CartDrawerHost` is
 * that `CartDrawer`: a small Client Component that hydrates
 * `stores/cart-store.ts` on mount and renders the (still fully
 * presentational) `MiniCartDrawer` bound to it — see `CartDrawerHost`'s
 * own doc comment for the full wiring. `SiteHeader`'s cart icon
 * (`CartHeaderButton`) opens the same store's drawer flag, so this only
 * needs mounting once here, not passed down through every page.
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
      <CartDrawerHost />
    </>
  );
}
