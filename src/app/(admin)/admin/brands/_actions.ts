"use server";

/** Server Actions for `/admin/brands` — see `admin/categories/_actions.ts`'s header comment for the shared rationale (Server Actions, not Route Handlers; `ActionResult`, never a thrown `AppError`, across the RSC boundary). */
import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { createBrandSchema, updateBrandSchema } from "@/lib/validation/admin/brand";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import {
  createBrand,
  deleteBrand,
  updateBrand,
  type AdminBrandRow,
} from "@/server/services/admin/brand";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const BRANDS_PATH = "/admin/brands";

export async function createBrandAction(input: unknown): Promise<ActionResult<AdminBrandRow>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("brand:write");
    const parsed = createBrandSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    const brand = await createBrand(parsed.data, actor);
    revalidatePath(BRANDS_PATH);
    return brand;
  });
}

export async function updateBrandAction(
  id: string,
  input: unknown,
): Promise<ActionResult<AdminBrandRow>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("brand:write");
    const parsed = updateBrandSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    const brand = await updateBrand(id, parsed.data, actor);
    revalidatePath(BRANDS_PATH);
    return brand;
  });
}

export async function deleteBrandAction(id: string): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("brand:write");
    await deleteBrand(id, actor);
    revalidatePath(BRANDS_PATH);
  });
}
