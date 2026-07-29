"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { setEnquiryStatusSchema } from "@/lib/validation/admin/enquiries";
import { setEnquiryStatus } from "@/server/services/admin/enquiries";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

export async function setEnquiryStatusAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = setEnquiryStatusSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("enquiry:reply");
    await setEnquiryStatus(parsed.data.enquiryId, parsed.data.status, actor);

    revalidatePath("/admin/enquiries");
  });
}
