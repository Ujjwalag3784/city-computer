"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { campaignFormSchema, setCampaignActiveSchema } from "@/lib/validation/admin/campaigns";
import {
  createCampaign,
  updateCampaign,
  setCampaignActive,
} from "@/server/services/admin/campaigns";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const CAMPAIGNS_LIST_PATH = "/admin/campaigns";

export async function createCampaignAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(async () => {
    const parsed = campaignFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("promotion:write");
    const created = await createCampaign(parsed.data, actor);

    revalidatePath(CAMPAIGNS_LIST_PATH);
    return created;
  });
}

export async function updateCampaignAction(
  campaignId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = campaignFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("promotion:write");
    await updateCampaign(campaignId, parsed.data, actor);

    revalidatePath(CAMPAIGNS_LIST_PATH);
    revalidatePath(`${CAMPAIGNS_LIST_PATH}/${campaignId}`);
  });
}

export async function setCampaignActiveAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = setCampaignActiveSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("promotion:write");
    await setCampaignActive(parsed.data.campaignId, parsed.data.isActive, actor);

    revalidatePath(CAMPAIGNS_LIST_PATH);
  });
}
