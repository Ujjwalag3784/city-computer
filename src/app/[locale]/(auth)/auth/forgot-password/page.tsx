import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ForgotPasswordForm } from "./_components/forgot-password-form";

/**
 * `/auth/forgot-password` — the first half of docs/13 §2's reset flow.
 * `requestPasswordReset` had been built and tested since Phase 3 with no
 * page calling it, so there was no way for anyone to recover an account.
 *
 * Email only: docs/13 §2 sends reset links only to a verified email
 * address, and SMS reset is blocked until an SMS provider is contracted.
 * Staff who lose access are reset by the owner (`pnpm db:create-admin`).
 */
export const metadata: Metadata = {
  title: "Reset your password — City Computer Systems",
  robots: { index: false, follow: false },
};

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="text-headline-md">Forgot your password?</CardTitle>
        <CardDescription>
          Enter the email address on your account and we&apos;ll send you a link to choose a new
          one.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <ForgotPasswordForm />

        <p className="text-center text-body-sm text-on-surface-variant">
          Remembered it?{" "}
          <Link
            href="/auth/login"
            className="rounded text-on-surface underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
