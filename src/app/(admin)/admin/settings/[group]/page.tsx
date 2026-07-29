import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listSettingsByGroup } from "@/server/services/admin/settings";
import { SettingRow } from "../_components/setting-row";

export const metadata: Metadata = { title: "Settings — Admin — City Computer Systems" };

interface SettingsGroupPageProps {
  params: Promise<{ group: string }>;
}

export default async function AdminSettingsGroupPage({ params }: SettingsGroupPageProps) {
  const { group } = await params;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "settings:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect(`/auth/login?callbackUrl=/admin/settings/${group}`);
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const settings = await listSettingsByGroup(group);
  if (settings.length === 0) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface capitalize">{group}</h1>
      </div>
      <div className="flex flex-col gap-4">
        {settings.map((setting) => (
          <SettingRow
            key={setting.id}
            settingKey={setting.key}
            label={setting.label}
            helpText={setting.helpText}
            dataType={setting.dataType}
            value={setting.value}
          />
        ))}
      </div>
    </div>
  );
}
