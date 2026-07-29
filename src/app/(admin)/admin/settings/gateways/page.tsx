import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { GATEWAY_STATUS } from "@/server/services/admin/settings";

export const metadata: Metadata = { title: "Payment connections — Admin — City Computer Systems" };

/**
 * `/admin/settings/gateways` — docs/17 Phase 9's "gateway health" status
 * display. Payment gateway integration (eSewa/Khalti/Fonepay/connectIPS)
 * is out of scope for this whole project until the very end, per every
 * prior phase's own instruction — this page reports that honestly rather
 * than faking a health check against nothing. Cash on Delivery and Bank
 * Transfer both work today and don't need a "connection" at all.
 */
export default async function AdminGatewaysSettingsPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "settings:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect("/auth/login?callbackUrl=/admin/settings/gateways");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Payment connections</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Cash on Delivery and Bank Transfer both work today and need no setup here. Online payment
          providers haven&apos;t been connected yet.
        </p>
      </div>
      <ul className="flex flex-col divide-y divide-glass-stroke rounded-xl border border-glass-stroke">
        {GATEWAY_STATUS.map((gateway) => (
          <li key={gateway.name} className="flex items-center justify-between gap-4 p-4">
            <span className="text-body-md text-on-surface">{gateway.name}</span>
            <div className="flex items-center gap-2">
              <Badge variant="glass">Not connected</Badge>
              <span className="text-body-sm text-on-surface-variant">{gateway.helperText}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
