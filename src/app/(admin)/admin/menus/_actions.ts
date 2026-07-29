"use server";

import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { menuItemFormSchema, moveMenuItemSchema } from "@/lib/validation/admin/menus";
import {
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  moveMenuItem,
  checkMenuLinks,
  type MenuLinkCheckResult,
} from "@/server/services/admin/menus";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const MENUS_PATH = "/admin/menus";

export async function createMenuItemAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return runAdminAction(async () => {
    const parsed = menuItemFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("menu:write");
    const created = await createMenuItem(parsed.data, actor);

    revalidatePath(MENUS_PATH);
    return created;
  });
}

export async function updateMenuItemAction(
  itemId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = menuItemFormSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("menu:write");
    await updateMenuItem(itemId, parsed.data, actor);

    revalidatePath(MENUS_PATH);
  });
}

export async function deleteMenuItemAction(itemId: string): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("menu:write");
    await deleteMenuItem(itemId, actor);
    revalidatePath(MENUS_PATH);
  });
}

export async function moveMenuItemAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = moveMenuItemSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("menu:write");
    await moveMenuItem(parsed.data.itemId, parsed.data.direction, actor);

    revalidatePath(MENUS_PATH);
  });
}

export async function checkMenuLinksAction(): Promise<ActionResult<MenuLinkCheckResult[]>> {
  return runAdminAction(async () => {
    await requireAdminPermission("menu:write");
    return checkMenuLinks();
  });
}
