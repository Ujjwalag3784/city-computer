import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/server/auth";
import { listOrdersForCustomerUser } from "@/server/services/commerce/order-lookup";
import { formatNPR } from "@/lib/money";

export const metadata: Metadata = {
  title: "Your orders — City Computer Systems",
  robots: { index: false, follow: false },
};

/**
 * `/account` — the destination the header's Account icon opens into
 * (`components/layout/account-menu.tsx`), and `mobile-nav.tsx`'s
 * `/account` entry, which 404'd before this page existed. Confirmed as a
 * genuine gap by the remediation audit, `docs/AUDIT.md` — no customer
 * account area existed anywhere in this codebase.
 *
 * Deliberately just an order-history list, not a full profile/settings
 * page — docs/02 §4's fuller account section (addresses, saved payment
 * methods, profile editing) isn't built yet either; flagged as a further
 * gap rather than silently expanded into here. This is the one thing a
 * returning customer most needs "an account" for at all: seeing what they
 * ordered.
 *
 * `auth()` here (not `middleware.ts`) is the actual gate — this route
 * isn't part of `/admin/*`, so `adminMiddleware` never touches it.
 * Redirects with `callbackUrl` set, same pattern every admin redirect
 * already uses, so signing in returns the shopper here rather than to the
 * homepage.
 */
export default async function AccountPage() {
  const session = await auth();
  if (!session) {
    redirect("/auth/login?callbackUrl=/account");
  }

  const orders = await listOrdersForCustomerUser(session.user.id);

  return (
    <div className="mx-auto flex max-w-[720px] flex-col gap-6 p-4 py-12 sm:p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Your orders</h1>
        <p className="text-body-sm text-on-surface-variant">
          Signed in as {session.user.email ?? session.user.name}.
        </p>
      </div>

      {orders.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-8 text-center">
          <p className="text-body-md text-on-surface">You haven&apos;t placed an order yet.</p>
          <Link
            href="/"
            className="rounded text-body-sm text-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Browse the catalogue
          </Link>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => (
            <li key={order.id}>
              <Link
                href={`/order/${order.orderNumber}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-glass-stroke bg-surface-container p-4 transition-colors hover:border-primary-container/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-label-mono-xs text-on-surface-variant">
                    {order.orderNumber}
                  </span>
                  <span className="text-body-sm text-on-surface-variant">
                    {order.placedAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-body-md font-medium text-on-surface">
                    {formatNPR(order.totalPaisa)}
                  </span>
                  <Badge variant="glass">{titleCaseStatus(order.status)}</Badge>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Same small transform `/admin/orders`'s own list page and `server/services/admin/dashboard.ts` already each keep locally — duplicated here rather than shared, matching this codebase's own established precedent for this exact one-off formatter. */
function titleCaseStatus(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
