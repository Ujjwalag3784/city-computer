"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { branchFormSchema } from "@/lib/validation/admin/branches";
import { createBranch, updateBranch } from "@/server/services/admin/branches";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const BRANCHES_LIST_PATH = "/admin/branches";

export async function createBranchAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(async () => {
    const parsed = branchFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("branch:write");
    const created = await createBranch(parsed.data, actor);

    revalidatePath(BRANCHES_LIST_PATH);
    return created;
  });
}

export async function updateBranchAction(
  branchId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = branchFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("branch:write");
    await updateBranch(branchId, parsed.data, actor);

    revalidatePath(BRANCHES_LIST_PATH);
    revalidatePath(`${BRANCHES_LIST_PATH}/${branchId}`);
  });
}
