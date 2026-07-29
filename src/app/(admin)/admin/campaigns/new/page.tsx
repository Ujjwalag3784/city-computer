import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { CampaignForm, EMPTY_CAMPAIGN_FORM } from "../_components/campaign-form";

export const metadata: Metadata = { title: "Add a campaign — Admin — City Computer Systems" };

export default async function NewCampaignPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "promotion:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect("/auth/login?callbackUrl=/admin/campaigns/new");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Add a campaign</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Set up the basics here, then ask a developer to configure exactly what it discounts.
        </p>
      </div>
      <CampaignForm initialValues={EMPTY_CAMPAIGN_FORM} />
    </div>
  );
}
