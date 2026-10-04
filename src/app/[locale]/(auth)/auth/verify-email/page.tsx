import type { Metadata } from "next";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { VerifyEmailForm } from "./_components/verify-email-form";

/**
 * `/auth/verify-email?token=…` — where a sign-up confirmation email lands.
 *
 * Verification happens on a button press, not on page load. Mail providers
 * and corporate link scanners open every link in an email to check it for
 * malware; verifying on GET would let that scanner spend the single-use
 * token before the customer ever clicks.
 */
export const metadata: Metadata = {
  title: "Confirm your email — City Computer Systems",
  robots: { index: false, follow: false },
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="text-headline-md">Confirm your email</CardTitle>
        <CardDescription>
          One click and we can send you order updates and password resets.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        {token ? (
          <VerifyEmailForm token={token} />
        ) : (
          <Alert variant="destructive">
            <AlertDescription className="text-danger">
              This link is missing its confirmation code. Open the link from your email again.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
