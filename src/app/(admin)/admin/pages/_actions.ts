"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { pageFormSchema } from "@/lib/validation/admin/pages";
import { createPage, updatePage, deletePage } from "@/server/services/admin/pages";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const PAGES_LIST_PATH = "/admin/pages";

export async function createPageAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(async () => {
    const parsed = pageFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("page:write");
    const created = await createPage(parsed.data, actor);

    revalidatePath(PAGES_LIST_PATH);
    return created;
  });
}

export async function updatePageAction(
  pageId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = pageFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("page:write");
    await updatePage(pageId, parsed.data, actor);

    revalidatePath(PAGES_LIST_PATH);
    revalidatePath(`${PAGES_LIST_PATH}/${pageId}`);
  });
}

export async function deletePageAction(pageId: string): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("page:write");
    await deletePage(pageId, actor);
    revalidatePath(PAGES_LIST_PATH);
  });
}
