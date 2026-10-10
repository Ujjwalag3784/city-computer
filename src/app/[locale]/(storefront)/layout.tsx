import type { ReactNode } from "react";
import { after } from "next/server";
import { maybeReleaseExpiredReservations } from "@/server/services/commerce/stock-reservation";
import { AnnouncementBar } from "@/components/layout/announcement-bar";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { CookieConsent } from "@/components/layout/cookie-consent";
import { CartDrawerHost } from "@/components/commerce/cart-drawer-host";
import { BUILD_NAV_ITEM, PRIMARY_NAV_ITEMS } from "@/config/navigation";
import { STORE_MAPS_SHARE_URL } from "@/config/store";
import { formatNepalPhoneForDisplay } from "@/lib/nepal";
import { isAdminRoleKey } from "@/lib/admin-roles";
import { auth } from "@/server/auth";
import { getStoreSettings, whatsappUrl } from "@/server/services/store-settings";
import { MaintenancePage } from "./_components/maintenance-page";
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
  const [session, shop] = await Promise.all([auth(), getStoreSettings()]);
  // Hands unpaid orders' expired stock holds back to the shelf, after the
  // response is sent (throttled to once per 10 minutes).
  after(maybeReleaseExpiredReservations);
  const user = session
    ? { name: session.user.name ?? null, email: session.user.email ?? null }
    : null;

  // Maintenance mode (Admin → Settings): customers see a holding page;
  // signed-in staff still see the real shop so they can check their work.
  const isStaff = (session?.user.roleKeys ?? []).some(isAdminRoleKey);
  if (shop.maintenanceMode && !isStaff) {
    return <MaintenancePage whatsappE164={shop.whatsappE164} phoneE164={shop.phoneE164} />;
  }

  return (
    <>
      <AnnouncementBar
        highlight="Delivery"
        message="across Kathmandu Valley in 1–2 days, or pick up from our New Road showroom"
        meta={[
          { label: shop.address, href: STORE_MAPS_SHARE_URL },
          {
            label: `${formatNepalPhoneForDisplay(shop.whatsappE164)} (WhatsApp)`,
            href: whatsappUrl(shop.whatsappE164),
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

      <SiteFooter
        onSubscribe={subscribeNewsletterAction}
        contact={{
          address: shop.address,
          phoneE164: shop.phoneE164,
          whatsappE164: shop.whatsappE164,
          email: shop.email,
        }}
      />
      <CookieConsent />
      <CartDrawerHost />
    </>
  );
}
