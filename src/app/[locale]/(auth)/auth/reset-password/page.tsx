import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ResetPasswordForm } from "./_components/reset-password-form";

/**
 * `/auth/reset-password?token=…` — where a reset email lands.
 *
 * The token is NOT checked on page load: doing so would make the check a
 * GET side effect and give an oracle for probing tokens. It is checked
 * once, by `resetPassword`, when the new password is submitted.
 *
 * `Referrer-Policy: strict-origin-when-cross-origin` (next.config.ts) keeps
 * the token in this URL from leaking to any third-party request, and this
 * page loads none.
 */
export const metadata: Metadata = {
  title: "Choose a new password — City Computer Systems",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="text-headline-md">Choose a new password</CardTitle>
        <CardDescription>
          You&apos;ll be signed out everywhere else once it&apos;s saved, then you can sign in with
          the new one.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <>
            <Alert variant="destructive">
              <AlertDescription className="text-danger">
                This link is missing its reset code. Open the link from your email again, or ask for
                a new one.
              </AlertDescription>
            </Alert>
            <Button asChild size="lg" className="w-full">
              <Link href="/auth/forgot-password">Send a new link</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
