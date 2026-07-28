import type { ReactNode } from "react";
import Link from "next/link";
import { Heart, Search, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MobileNav, DEFAULT_NAV_ITEMS, type NavItem } from "@/components/layout/mobile-nav";
import { CartHeaderButton } from "@/components/commerce/cart-header-button";

/**
 * SiteHeader — docs/05-DESIGN-SYSTEM.md §6 component inventory:
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
 * Wishlist count is still a plain optional number prop — no wishlist
 * feature/store exists yet. The cart badge is different as of docs/17
 * Phase 6: `CartHeaderButton` (the one Client Component this file renders)
 * reads the real count from `stores/cart-store.ts`, falling back to
 * `cartCount` only before that store has hydrated (or on the `/design`
 * showcase route, which never hydrates it at all).
 */
export interface SiteHeaderProps {
  /** Which chrome to render. Defaults to `"full"`. */
  variant?: "full" | "with-search" | "minimal";
  /** Primary nav taxonomy, shared with `MobileNav`. Defaults to `DEFAULT_NAV_ITEMS`. */
  navItems?: NavItem[];
  /** Shown on the wishlist badge when greater than 0. Defaults to 0 (badge hidden). */
  wishlistCount?: number;
  /** Fallback shown on the cart badge only before `stores/cart-store.ts` has hydrated a real count (see `CartHeaderButton`). Defaults to 0 (badge hidden). */
  cartCount?: number;
  /** Right-aligned slot rendered only in `variant="minimal"` (e.g. a "Secure checkout" label). */
  minimalActions?: ReactNode;
}

const iconButtonFocusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function SiteHeader({
  variant = "full",
  navItems = DEFAULT_NAV_ITEMS,
  wishlistCount = 0,
  cartCount = 0,
  minimalActions,
}: SiteHeaderProps) {
  return (
    <header>
      <a
        href="#main-content"
        className={cn(
          "sr-only focus:not-sr-only",
          "focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-body-sm focus:font-medium focus:text-on-primary",
          iconButtonFocusRing,
        )}
      >
        Skip to content
      </a>

      <div className="sticky top-0 z-40 nav-height glass-panel">
        <div className="mx-auto flex h-full max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <Link
            href="/"
            className={cn("rounded text-title font-display text-on-surface", iconButtonFocusRing)}
          >
            City Computer
          </Link>

          {variant === "minimal" ? (
            (minimalActions ?? null)
          ) : (
            <>
              {variant === "full" && (
                <nav aria-label="Primary" className="hidden items-center gap-6 lg:flex">
                  {navItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "rounded text-body-sm text-on-surface-variant transition-colors hover:text-on-surface",
                        iconButtonFocusRing,
                      )}
                    >
                      {item.label}
                    </Link>
                  ))}
                </nav>
              )}

              <div className="flex items-center gap-1">
                {variant === "with-search" ? (
                  <div className="relative hidden md:flex">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
                    <Input
                      type="search"
                      placeholder="Search products..."
                      aria-label="Search products"
                      className="w-64 pl-9"
                    />
                  </div>
                ) : (
                  <Button variant="ghost" size="md" iconOnly aria-label="Search">
                    <Search />
                  </Button>
                )}

                <Button
                  variant="ghost"
                  size="md"
                  iconOnly
                  aria-label="Wishlist"
                  className="relative"
                >
                  <Heart />
                  {wishlistCount > 0 && (
                    <Badge
                      variant="primary"
                      className="absolute -right-1 -top-1 min-w-4 justify-center px-1"
                    >
                      {wishlistCount}
                    </Badge>
                  )}
                </Button>

                <Button variant="ghost" size="md" iconOnly aria-label="Account">
                  <User />
                </Button>

                <CartHeaderButton fallbackCount={cartCount} />

                <div className="lg:hidden">
                  <MobileNav navItems={navItems} />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
