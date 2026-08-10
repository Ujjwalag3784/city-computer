"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * `(admin)/error.tsx` — catches any uncaught error from `(admin)/layout.tsx`
 * itself (session/auth check, the dashboard data fetch every admin page
 * reuses) or any page underneath it. Before this file existed, that class
 * of crash fell straight through to Next.js's bare default: a raw
 * "Application error: a server-side exception has occurred… Digest: …"
 * screen with no explanation and no way back — confirmed as a real,
 * live gap in the remediation audit (`docs/AUDIT.md` §1c), and the exact
 * shape of two production bugs already found and fixed this project
 * (an unguarded Redis timeout, a Server/Client boundary crash) before
 * this boundary existed to catch anything like it in the future.
 *
 * Not locale-wrapped (`(admin)` sits outside `[locale]/`, deliberately —
 * docs/04 §3), so this can't reuse `next-intl`'s `useTranslations` the
 * way the storefront's `StorefrontError` does — plain English, written
 * directly, same "Dad Mode" plain-language rule docs/09 sets for the rest
 * of the admin UI.
 *
 * Never renders `error.message` — same rule as `StorefrontError`
 * (docs/07 §2: never leak stack traces, SQL, or internal IDs to a user-
 * facing screen). Logs to the console only; no error-tracking service is
 * wired up yet (docs/19's known observability gap, not something this
 * fix pretends to solve).
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-headline-md text-on-surface">Something went wrong on this page.</p>
      <p className="max-w-[50ch] text-body-md text-on-surface-variant">
        Nothing you did caused this — try again, or head back to Today. If it keeps happening, note
        what you were doing when it happened.
      </p>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/admin">Go to Today</Link>
        </Button>
      </div>
      {error.digest && (
        <p className="font-mono text-label-mono-xs text-on-surface-variant/70">
          Reference: {error.digest}
        </p>
      )}
    </div>
  );
}
