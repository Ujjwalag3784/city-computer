import type { ReactNode } from "react";
import Link from "next/link";

/**
 * `[locale]/(auth)/layout.tsx` — the route group `[locale]/layout.tsx`'s own
 * comment already anticipated ("the entire storefront, and eventually
 * `(builder)`/`(checkout)`/`(account)`/`(auth)`").
 *
 * A deliberately bare shell: no `SiteHeader`, no announcement bar, no cart
 * drawer. A sign-in screen with the full shop chrome invites someone to
 * wander off mid-login, and the header's cart button would mount the cart
 * store on a page that has nothing to do with shopping.
 *
 * It sits under `[locale]/` rather than at the app root so that next-intl's
 * middleware — which rewrites every unprefixed path to the default locale —
 * can resolve `/auth/login` without a 404. A top-level `(auth)` group would
 * have needed `auth` adding to `middleware.ts`'s matcher exclusion list
 * instead, which is the same outcome with an extra special case.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4 py-10 sm:px-6 sm:py-16"
    >
      {/*
        `text-title`, not `text-title-lg`: globals.css defines
        display-lg / headline-lg / headline-md / title / body-* and nothing
        called `title-lg`, so the original class produced no CSS at all and
        the wordmark rendered at the browser's default size.
      */}
      <Link
        href="/"
        className="text-title rounded text-on-surface transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        City Computer Systems
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
