import type { ReactNode } from "react";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CookieConsent } from "@/components/layout/cookie-consent";
import { CartDrawerHost } from "@/components/commerce/cart-drawer-host";
import { BUILD_NAV_ITEM, PRIMARY_NAV_ITEMS } from "@/config/navigation";
import {
  STORE_ADDRESS_LABEL,
  STORE_MAPS_SHARE_URL,
  STORE_WHATSAPP_E164,
  STORE_WHATSAPP_URL,
} from "@/config/store";
import { formatNepalPhoneForDisplay } from "@/lib/nepal";
import { auth } from "@/server/auth";
import { subscribeNewsletterAction } from "./_actions";

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
 *
 * `async` + `auth()`: the one place the storefront checks who (if anyone)
 * is signed in, so `SiteHeader`'s `AccountMenu` can render the right pair
 * of items (docs/AUDIT.md §1a's Account-icon bug, fixed via
 * `account-menu.tsx`). Every storefront page pays this cost once per
 * request via layout caching, not once per page.
 */
export default async function StorefrontLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const user = session
    ? { name: session.user.name ?? null, email: session.user.email ?? null }
    : null;

  return (
    <>
      <AnnouncementBar
        highlight="Free delivery"
        message="inside Kathmandu Valley on orders over रु 5,000"
        meta={[
          { label: STORE_ADDRESS_LABEL, href: STORE_MAPS_SHARE_URL },
          {
            label: `${formatNepalPhoneForDisplay(STORE_WHATSAPP_E164)} (WhatsApp)`,
            href: STORE_WHATSAPP_URL,
          },
        ]}
      />
      <SiteHeader
        variant="with-search"
        navItems={PRIMARY_NAV_ITEMS}
        ctaItem={BUILD_NAV_ITEM}
        user={user}
      />

      <main id="main-content">{children}</main>

      <SiteFooter onSubscribe={subscribeNewsletterAction} />
      <CookieConsent />
      <CartDrawerHost />
    </>
  );
}
