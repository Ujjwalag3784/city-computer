import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listSettingGroups } from "@/server/services/admin/settings";

export const metadata: Metadata = { title: "Settings — Admin — City Computer Systems" };

/** `/admin/settings` — docs/09-ADMIN-DAD-MODE.md §3, OWNER only. */
export default async function AdminSettingsPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "settings:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) redirect("/auth/login?callbackUrl=/admin/settings");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const groups = await listSettingGroups();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Settings</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Contact details, payments, and the switches that change how the website behaves.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <Link key={group.group} href={`/admin/settings/${group.group}`}>
            <Card
              variant="surface"
              className="h-full transition-colors hover:border-primary-container"
            >
              <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
                <p className="text-body-lg font-medium text-on-surface">{group.label}</p>
                <p className="text-body-sm text-on-surface-variant">
                  {group.settingCount} setting{group.settingCount === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
        <Link href="/admin/settings/shipping">
          <Card
            variant="surface"
            className="h-full transition-colors hover:border-primary-container"
          >
            <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
              <p className="text-body-lg font-medium text-on-surface">Delivery pricing</p>
              <p className="text-body-sm text-on-surface-variant">Shipping zones and rates</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/admin/settings/gateways">
          <Card
            variant="surface"
            className="h-full transition-colors hover:border-primary-container"
          >
            <CardContent className="flex flex-col gap-1 pt-[--space-card-padding]">
              <p className="text-body-lg font-medium text-on-surface">Payment connections</p>
              <p className="text-body-sm text-on-surface-variant">
                Status of eSewa, Khalti, Fonepay, connectIPS
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
