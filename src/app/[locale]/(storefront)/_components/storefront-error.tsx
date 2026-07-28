"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * Shared body for every `error.tsx` boundary under `(storefront)/` (`c/`,
 * `b/`, `p/`, `search/`) — each route's own `error.tsx` just re-exports
 * this (Next.js requires the file to exist per-segment; it doesn't
 * require the *implementation* to be duplicated per segment).
 *
 * Never renders `error.message` — docs/07-API-DESIGN.md §2's "never leak
 * stack traces, SQL, provider secrets, or internal IDs in errors" applies
 * to the storefront's own error boundaries just as much as to a JSON API
 * response. Logging the real error to a monitoring service (not built
 * yet — see docs/19's observability gap) would happen here; today this
 * only logs to the browser console for local debugging.
 */
export function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("common");

  useEffect(() => {
    // No server logger reaches the browser, and no error-tracking service
    // is wired up yet — the browser console is the only place this goes
    // today.
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-4 p-8 py-24 text-center">
      <p className="text-headline-sm text-on-surface">{t("somethingWentWrong")}</p>
      <Button onClick={reset}>{t("tryAgain")}</Button>
    </div>
  );
}
