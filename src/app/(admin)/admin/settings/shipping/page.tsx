import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listShippingZonesForAdmin } from "@/server/services/admin/settings";
import { ShippingRateRow } from "../_components/shipping-rate-row";

export const metadata: Metadata = { title: "Delivery pricing — Admin — City Computer Systems" };

/**
 * `/admin/settings/shipping` — docs/17 Phase 9's "shipping zones" setting.
 * Edits the price and estimated delivery time of each zone's existing
 * flat rate. Adding brand-new zones or districts (a district multi-
 * select picker) is NOT built this pass — flagged, not silently missing;
 * a developer can add zones via the seed/DB directly.
 */
export default async function AdminShippingSettingsPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "settings:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect("/auth/login?callbackUrl=/admin/settings/shipping");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const zones = await listShippingZonesForAdmin();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Delivery pricing</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          What you charge for delivery, and how long customers are told to expect it. Adding a
          brand-new delivery zone needs a developer for now.
        </p>
      </div>
      <div className="flex flex-col gap-4">
        {zones.map((zone) => (
          <ShippingRateRow key={zone.id} zone={zone} />
        ))}
      </div>
    </div>
  );
}
