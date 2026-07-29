"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import {
  createStaffSchema,
  updateStaffRoleSchema,
  setStaffStatusSchema,
} from "@/lib/validation/admin/staff";
import { createStaffMember, updateStaffRole, setStaffStatus } from "@/server/services/admin/staff";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const USERS_LIST_PATH = "/admin/users";

export async function createStaffAction(
  input: unknown,
): Promise<ActionResult<{ id: string; temporaryPassword: string }>> {
  return runAdminAction(async () => {
    const parsed = createStaffSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("user:manage");
    const created = await createStaffMember(parsed.data, actor);

    revalidatePath(USERS_LIST_PATH);
    return created;
  });
}

export async function updateStaffRoleAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = updateStaffRoleSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("user:manage");
    await updateStaffRole(parsed.data.userId, parsed.data.roleKey, actor);

    revalidatePath(USERS_LIST_PATH);
  });
}

export async function setStaffStatusAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = setStaffStatusSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("user:manage");
    await setStaffStatus(parsed.data.userId, parsed.data.isActive, actor);

    revalidatePath(USERS_LIST_PATH);
  });
}
