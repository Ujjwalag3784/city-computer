import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, NotFoundError, UnauthenticatedError } from "@/lib/errors";
import { getCampaignForAdmin } from "@/server/services/admin/campaigns";
import { CampaignForm, type CampaignFormValues } from "../_components/campaign-form";

export const metadata: Metadata = { title: "Edit campaign — Admin — City Computer Systems" };

interface EditCampaignPageProps {
  params: Promise<{ id: string }>;
}

function toDateInputValue(date: Date | null): string {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export default async function EditCampaignPage({ params }: EditCampaignPageProps) {
  const { id } = await params;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "promotion:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect(`/auth/login?callbackUrl=/admin/campaigns/${id}`);
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  let campaign;
  try {
    campaign = await getCampaignForAdmin(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const initialValues: CampaignFormValues = {
    name: campaign.name,
    type: campaign.type,
    priority: campaign.priority,
    stackable: campaign.stackable,
    startsAt: toDateInputValue(campaign.startsAt),
    endsAt: toDateInputValue(campaign.endsAt),
    isActive: campaign.isActive,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Edit {campaign.name}</h1>
      </div>
      <CampaignForm campaignId={campaign.id} initialValues={initialValues} />
    </div>
  );
}
