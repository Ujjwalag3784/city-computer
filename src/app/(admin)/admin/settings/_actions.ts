"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { rupeesToPaisa } from "@/lib/money";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { updateSettingSchema, updateShippingRateSchema } from "@/lib/validation/admin/settings";
import { updateSetting, updateShippingRate } from "@/server/services/admin/settings";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

export async function updateSettingAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = updateSettingSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("settings:write");
    await updateSetting(parsed.data.key, parsed.data.rawValue, actor);

    revalidatePath("/admin/settings");
  });
}

export async function updateShippingRateAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = updateShippingRateSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("settings:write");
    await updateShippingRate(
      parsed.data.rateId,
      rupeesToPaisa(parsed.data.basePriceRupees),
      parsed.data.estimatedDaysMin,
      parsed.data.estimatedDaysMax,
      actor,
    );

    revalidatePath("/admin/settings/shipping");
  });
}
