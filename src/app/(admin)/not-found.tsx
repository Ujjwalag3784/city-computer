import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * `(admin)/not-found.tsx` — catches every `notFound()` call under
 * `(admin)/` (a nonexistent admin route, or `requirePermission`/
 * `requireAdminSession` denying a signed-in-but-unauthorised user —
 * see `(admin)/layout.tsx` and `middleware.ts`'s shared "wrong role gets
 * 404, not a friendlier page" posture, docs/13-SECURITY.md §3: a denied
 * request must not confirm the admin surface exists). Deliberately
 * generic for that same reason — this text is identical whether the
 * route is genuinely missing or the signed-in user just lacks the
 * permission for it.
 *
 * Before this file existed, any of the above fell through to Next.js's
 * bare default 404 — plain, but also unbranded and with no way back into
 * the parts of the admin the user *can* reach (confirmed as a real gap
 * in the remediation audit, `docs/AUDIT.md` §1c).
 */
export default function AdminNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-headline-md text-on-surface">We couldn&apos;t find that page.</p>
      <p className="max-w-[50ch] text-body-md text-on-surface-variant">
        The page may have moved, or you may not have access to it.
      </p>
      <Button asChild>
        <Link href="/admin">Go to Today</Link>
      </Button>
    </div>
  );
}
