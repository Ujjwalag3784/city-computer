import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { MobileNav, DEFAULT_NAV_ITEMS, type NavItem } from "@/components/layout/mobile-nav";
import { CartHeaderButton } from "@/components/commerce/cart-header-button";
import { AccountMenu, type AccountMenuUser } from "@/components/layout/account-menu";
import { BrandMark } from "@/components/layout/brand-mark";
import { PrimaryNav } from "@/components/layout/primary-nav";
import { SearchForm } from "@/components/layout/search-form";

/**
 * SiteHeader — 2026-10-04 Obsidian Kinetic redesign (Stitch export): a
 * sticky two-row header — brand / search / account + cart on top, and the
 * category row with the "Build a PC" call-to-action underneath (see
 * `PrimaryNav`). On phones the search drops to its own full-width row.
 *
 * docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "`SiteHeader` (full / with-search / minimal)". One component, three
 * variants, so the header can never drift per screen the way the Stitch
 * exports did — docs/05 §1 CORRECTED #5: three different nav heights
 * (64/72/80px) across screens. Every variant here renders the single
 * `nav-height` utility (`--nav-h: 72px`), sticky and `glass-panel`.
 *
 * Server Component: nothing in this file holds local state. `MobileNav`'s
 * sheet manages its own open/closed state internally via Radix, so lifting
 * that state up here would only add a needless client boundary — a plain
 * typed function component (no `"use client"`) is correct.
 *
 * Accessibility: the skip-link is the first element under `<header>`,
 * satisfying docs/05 §5 A11 ("Skip-to-content link") — it targets
 * `#main-content`, which the page-level layout is responsible for
 * rendering on `<main>`. Every icon-only button below carries an explicit
 * `aria-label` and a 44×44 hit target via `Button`'s `iconOnly` prop
 * (docs/05 §5 A2, A9).
 *
 * The Wishlist icon this header used to render is gone (removed
 * 2026-08-10, remediation audit `docs/AUDIT.md` §1a): it had no `onClick`
 * or `href` — a fully inert control — and no wishlist feature exists
 * anywhere in this codebase (no store, no Prisma model, no service) to
 * wire it to. Per the remediation brief's own rule, "an inert button is
 * worse than no button" — removed rather than left to look broken. If a
 * real wishlist feature gets built later, this is where its entry point
 * belongs.
 *
 * The cart badge is real, unlike the wishlist one that used to sit next
 * to it: `CartHeaderButton` (the one Client Component this file renders)
 * reads the live count from `stores/cart-store.ts`, falling back to
 * `cartCount` only before that store has hydrated (or on the `/design`
 * showcase route, which never hydrates it at all).
 *
 * The Account icon used to be exactly as inert as the wishlist one — no
 * `onClick`/`href` (remediation audit, `docs/AUDIT.md` §1a's second named
 * bug: "the person/account icon in the header does nothing on click").
 * Unlike wishlist, a real feature existed to wire it to (auth already had
 * a customer role, a session policy, everything except pages and a menu —
 * see `account-menu.tsx`'s own doc comment), so this one got built out
 * rather than removed. `(storefront)/layout.tsx` is the one caller that
 * fetches `auth()` and passes a real `user`; the `/design` showcase
 * renders this component without that prop, which is fine — `AccountMenu`
 * treats a missing `user` exactly like a signed-out one.
 */
export interface SiteHeaderProps {
  /** `"full"` and `"with-search"` render the same chrome now (search is always present); `"minimal"` is brand + `minimalActions` only. */
  variant?: "full" | "with-search" | "minimal";
  /** Primary nav taxonomy, shared with `MobileNav`. Defaults to `DEFAULT_NAV_ITEMS`. */
  navItems?: NavItem[];
  /** The orange call-to-action at the end of the category row. */
  ctaItem?: NavItem;
  /** Fallback shown on the cart badge only before `stores/cart-store.ts` has hydrated a real count (see `CartHeaderButton`). Defaults to 0 (badge hidden). */
  cartCount?: number;
  /** Right-aligned slot rendered only in `variant="minimal"` (e.g. a "Secure checkout" label). */
  minimalActions?: ReactNode;
  /** Signed-in shopper, or `null`/`undefined` when signed out. Drives `AccountMenu`'s two states. */
  user?: AccountMenuUser | null;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function SiteHeader({
  variant = "full",
  navItems = DEFAULT_NAV_ITEMS,
  ctaItem,
  cartCount = 0,
  minimalActions,
  user = null,
}: SiteHeaderProps) {
  const minimal = variant === "minimal";

  return (
    <header className="sticky top-0 z-40 border-b border-outline-variant bg-glass-bg backdrop-blur-[var(--glass-blur)]">
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only",
          "focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-body-sm focus:font-medium focus:text-on-primary",
          focusRing,
        )}
      >
        Skip to content
      </a>

      <div className="mx-auto flex h-16 max-w-[1440px] items-center gap-3 px-4 sm:px-6 lg:gap-8 lg:px-12">
        {!minimal && (
          <div className="-ml-2 lg:hidden">
            <MobileNav navItems={ctaItem ? [...navItems, ctaItem] : navItems} />
          </div>
        )}

        <Link
          href="/"
          aria-label="City Computer Systems — home"
          className={cn("rounded", focusRing)}
        >
          <BrandMark className="hidden sm:inline-flex" />
          <BrandMark compact className="sm:hidden" />
        </Link>

        {minimal ? (
          <div className="ml-auto">{minimalActions ?? null}</div>
        ) : (
          <>
            <SearchForm id="header-search" className="mx-auto hidden w-full max-w-xl md:block" />

            <div className="ml-auto flex items-center gap-1 md:ml-0">
              <AccountMenu user={user} />
              <CartHeaderButton fallbackCount={cartCount} />
            </div>
          </>
        )}
      </div>

      {!minimal && (
        <>
          <div className="px-4 pb-3 sm:px-6 md:hidden">
            <SearchForm id="header-search-mobile" />
          </div>
          <PrimaryNav items={navItems} cta={ctaItem} />
        </>
      )}
    </header>
  );
}
