import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Link } from "@/i18n/navigation";
import { safeInternalPath } from "@/lib/safe-redirect";
import { LoginForm } from "./_components/login-form";

/**
 * `/auth/login` — the page `authConfig.pages.signIn`, `middleware.ts`'s
 * `adminMiddleware`, and `(admin)/layout.tsx` have all pointed at since
 * Phase 3 without it existing. Until now every one of those redirects
 * landed on a 404, so no account could sign in and the whole admin console
 * was unreachable regardless of what was in the database.
 *
 * `noindex`: a sign-in form has no business in search results.
 *
 * Deliberately does NOT call `auth()` to bounce an already-signed-in
 * visitor onwards. `auth()` runs the session callback, which reads Redis for
 * the 2FA flag — if Redis were unreachable that would throw *on the sign-in
 * page itself*, locking everyone out of the one screen they need to recover.
 * Showing the form to someone who is already signed in is a harmless
 * cosmetic wart; a 500 here is not.
 */
export const metadata: Metadata = {
  title: "Sign in — City Computer Systems",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; reason?: string }>;
}) {
  const { callbackUrl, reason } = await searchParams;
  const safeCallbackUrl = safeInternalPath(callbackUrl, "/admin");
  // This page now serves two audiences (docs/AUDIT.md's Critical Path 5
  // gap: customer registration/login didn't exist at all before this).
  // `authorize()` and the session policy already treat staff and
  // customers identically at the credential-check level — the only thing
  // that differs is which copy makes sense to read, and that's a function
  // of *where this sign-in was going to send them*, not a separate route.
  // Every existing admin redirect (middleware.ts, (admin)/layout.tsx) sets
  // `callbackUrl` to an `/admin/...` path; every customer-facing entry
  // point (the header's Account menu) sets it to `/account` or similar.
  const isStaffContext = safeCallbackUrl.startsWith("/admin");

  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="text-headline-md">Sign in</CardTitle>
        <CardDescription>
          {isStaffContext ? (
            // Was "use the email and password created with `pnpm
            // db:create-admin`" — a build instruction for whoever set the
            // site up, rendered as guidance to whoever is standing in
            // front of it. Nobody signing into a shop's admin console
            // runs pnpm.
            <>
              Staff sign-in. Use the email address (or phone number) and password set up for you
              when your account was created.
            </>
          ) : (
            <>Use the email address (or phone number) and password from your account.</>
          )}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {/*
          `middleware.ts` appends `?reason=session-expired` when an admin
          session falls outside either the 8-hour absolute or 30-minute idle
          window (`session-state.ts`). Worth telling someone, so a silent
          bounce back to sign-in doesn't look like a bug.
        */}
        {reason === "session-expired" ? (
          <Alert variant="warning" role="status">
            <AlertDescription className="text-warning">
              Your session timed out. Staff sessions end after 8 hours, or after 30 minutes with no
              activity. Please sign in again.
            </AlertDescription>
          </Alert>
        ) : null}

        <LoginForm callbackUrl={safeCallbackUrl} />

        {!isStaffContext && (
          <p className="text-center text-body-sm text-on-surface-variant">
            New here?{" "}
            <Link
              href={{
                pathname: "/auth/register",
                query: safeCallbackUrl !== "/admin" ? { callbackUrl: safeCallbackUrl } : undefined,
              }}
              className="rounded text-on-surface underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Create an account
            </Link>
          </p>
        )}
      </CardContent>
    </Card>
  );
}
