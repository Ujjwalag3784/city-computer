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
      className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12"
    >
      <Link href="/" className="text-title-lg font-semibold text-on-surface">
        City Computer Systems
      </Link>
      <div className="w-full max-w-md">{children}</div>
    </main>
  );
}
