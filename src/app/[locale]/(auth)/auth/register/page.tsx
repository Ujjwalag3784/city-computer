import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { safeInternalPath } from "@/lib/safe-redirect";
import { RegisterForm } from "./_components/register-form";

/**
 * `/auth/register` — the missing half of the login page's own note
 * ("Staff accounts only for now"): a real customer registration flow.
 * Confirmed as a genuine gap by the remediation audit (`docs/AUDIT.md`
 * §1b, Critical Path 5) — the backend for this already existed
 * (`server/services/auth/register.ts`, `lib/validation/auth.ts`'s
 * `registerSchema`, even a customer-specific 30-day session policy in
 * `server/auth/config.ts`) with no page ever calling any of it.
 *
 * `noindex`, same reasoning as `/auth/login`: a form has no business in
 * search results.
 */
export const metadata: Metadata = {
  title: "Create an account — City Computer Systems",
  robots: { index: false, follow: false },
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const safeCallbackUrl = safeInternalPath(callbackUrl, "/account");

  return (
    <Card>
      <CardHeader className="gap-2">
        <CardTitle className="text-headline-md">Create an account</CardTitle>
        <CardDescription>
          Track your orders and check out faster next time. Takes a minute.
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-6">
        <RegisterForm callbackUrl={safeCallbackUrl} />

        <p className="text-center text-body-sm text-on-surface-variant">
          Already have an account?{" "}
          <Link
            href={{
              pathname: "/auth/login",
              query: safeCallbackUrl !== "/account" ? { callbackUrl: safeCallbackUrl } : undefined,
            }}
            className="rounded text-on-surface underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
