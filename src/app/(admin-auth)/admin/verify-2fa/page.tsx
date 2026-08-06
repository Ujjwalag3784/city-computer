import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { isAdminRoleKey, requiresTwoFactor } from "@/server/auth/permissions";
import { beginTwoFactorEnrollmentForSession } from "@/server/services/auth/two-factor";
import { safeInternalPath } from "@/lib/safe-redirect";
import { TwoFactorForm } from "./_components/two-factor-form";

/**
 * `/admin/verify-2fa` — the page `middleware.ts` has redirected
 * OWNER/MANAGER sessions to since Phase 3 without it existing. It handles
 * both first-time TOTP enrollment and the per-session code check, since to
 * the person in front of it those are one screen.
 *
 * WHY IT LIVES IN `(admin-auth)/` AND NOT `(admin)/`: `(admin)/layout.tsx`
 * calls `requireAdminSession`, which throws `ForbiddenError` — rendered as a
 * 404 — for exactly the state this page exists to resolve (an admin session
 * that has not yet satisfied 2FA). Putting the page inside that layout would
 * make it permanently unreachable. A sibling route group gives it the root
 * layout only, and the guards below re-implement the parts of
 * `requireAdminSession` that still apply.
 *
 * `middleware.ts` also has a single-path exemption so its own
 * "unsatisfied 2FA -> /admin/verify-2fa" redirect cannot target this page and
 * loop. That exemption skips *only* the 2FA redirect: a request here still
 * has to carry a valid session, an admin role, an allowed IP, and be inside
 * both session windows. Nothing about the 2FA requirement itself is relaxed
 * — the Redis flag `middleware.ts` and `guards.ts` check is only ever set by
 * a real verified code.
 */
export const metadata: Metadata = {
  title: "Two-factor sign-in — Admin — City Computer Systems",
  robots: { index: false, follow: false },
};

export default async function VerifyTwoFactorPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const target = safeInternalPath(callbackUrl, "/admin");

  const session = await auth();
  if (!session) {
    redirect(`/auth/login?callbackUrl=${encodeURIComponent(target)}`);
  }

  // Same posture as `adminMiddleware`: a non-staff session is not told this
  // page exists.
  if (!session.user.roleKeys.some(isAdminRoleKey)) {
    notFound();
  }

  // A role that doesn't require 2FA has nothing to do here, and neither does
  // a session that has already satisfied it — both would otherwise be able to
  // sit on a screen asking for a code they don't need.
  if (!requiresTwoFactor(session.user.roleKeys) || session.user.twoFactorVerified) {
    redirect(target);
  }

  // Enrollment is only offered to an account with no secret yet. For an
  // enrolled account this stays undefined and the form renders as a plain
  // code prompt — an enrolled account can never be walked back into
  // enrollment from here, which would be a way to replace a secret without
  // proving you hold the current one.
  const prompt = session.user.twoFactorEnabled
    ? undefined
    : await beginTwoFactorEnrollmentForSession(session.user.id, session.sessionToken);

  return (
    <main
      id="main-content"
      className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4 py-10 sm:px-6 sm:py-16"
    >
      <p className="text-title text-on-surface">City Computer Systems</p>

      <Card className="w-full max-w-md">
        <CardHeader className="gap-2">
          <CardTitle className="text-headline-md">
            {prompt ? "Set up two-factor sign-in" : "Enter your two-factor code"}
          </CardTitle>
          <CardDescription>
            {prompt
              ? "Owner and Manager accounts need a code from your phone as well as a password. This is a one-time setup."
              : "One more step before the admin area opens."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TwoFactorForm
            callbackUrl={target}
            qrCodeDataUrl={prompt?.qrCodeDataUrl}
            manualEntryKey={prompt?.manualEntryKey}
          />
        </CardContent>
      </Card>
    </main>
  );
}
