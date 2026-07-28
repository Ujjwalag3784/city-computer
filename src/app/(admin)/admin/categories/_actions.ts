"use server";

/**
 * Server Actions for `/admin/categories` — docs/07-API-DESIGN.md §1's
 * "admin CRUD" row: "only our own React code calls it and it's a
 * mutation" is exactly this screen, so these are Server Actions, not
 * `/api/v1/admin/*` Route Handlers. Each one: check the permission,
 * validate the input, call the service, revalidate the page, and return
 * a plain `ActionResult` — never a thrown `AppError` across the RSC
 * boundary (see `_lib/action-result.ts`).
 */
import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import {
  createCategorySchema,
  reorderCategoriesSchema,
  updateCategorySchema,
} from "@/lib/validation/admin/category";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import {
  createCategory,
  deleteCategory,
  reorderCategories,
  updateCategory,
  type AdminCategoryNode,
} from "@/server/services/admin/category";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const CATEGORIES_PATH = "/admin/categories";

export async function createCategoryAction(
  input: unknown,
): Promise<ActionResult<AdminCategoryNode>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("category:write");
    const parsed = createCategorySchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    const category = await createCategory(parsed.data, actor);
    revalidatePath(CATEGORIES_PATH);
    return category;
  });
}

export async function updateCategoryAction(
  id: string,
  input: unknown,
): Promise<ActionResult<AdminCategoryNode>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("category:write");
    const parsed = updateCategorySchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    const category = await updateCategory(id, parsed.data, actor);
    revalidatePath(CATEGORIES_PATH);
    return category;
  });
}

export async function reorderCategoriesAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("category:write");
    const parsed = reorderCategoriesSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    await reorderCategories(parsed.data, actor);
    revalidatePath(CATEGORIES_PATH);
  });
}

export async function deleteCategoryAction(id: string): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("category:write");
    await deleteCategory(id, actor);
    revalidatePath(CATEGORIES_PATH);
  });
}
