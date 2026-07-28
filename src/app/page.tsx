import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

/**
 * This file should be dead code. `src/app/[locale]/(storefront)/page.tsx`
 * is the real homepage now (see that file's header for why); under normal
 * operation, `middleware.ts`'s `next-intl` rewrite intercepts every
 * request to `/` and resolves it against the `[locale]` route tree before
 * Next.js's router would ever reach this literal `src/app/page.tsx`.
 *
 * It still exists, rather than being deleted, because of a sandbox
 * limitation: this working environment's mounted drive refuses to unlink
 * (`rm`) files it has already written — "Operation not permitted" even
 * though the same file can be freely overwritten. Deleting this file is a
 * two-second manual cleanup on your own machine (`rm src/app/page.tsx`)
 * whenever convenient; it's not load-bearing.
 *
 * In case middleware is ever bypassed and this genuinely renders,
 * redirect to a concrete, valid locale path rather than showing the
 * stale Phase 2 checkpoint content this file used to contain (which
 * would otherwise double up with the real storefront layout's header/
 * footer if both rendered at once).
 */
export default function RootPageFallback() {
  redirect(`/${routing.defaultLocale}`);
}
