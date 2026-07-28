"use server";

/**
 * Server Actions backing `/admin/inventory` (docs/09-ADMIN-DAD-MODE.md §6).
 * Same shape as every other admin route's `_actions.ts`: permission check
 * -> validate -> call the service -> revalidate -> plain `ActionResult`.
 * All three gated on `stock:update` — the narrowest permission every role
 * allowed on this screen (OWNER, MANAGER, STAFF per §3's module map)
 * actually holds, per `prisma/seed/core.ts`.
 */
import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { bulkStockAdjustSchema, stockAdjustSchema } from "@/lib/validation/admin/inventory";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import {
  bulkAdjustStock,
  getStockHistoryForVariant,
  type BulkStockAdjustResult,
  type StockHistoryResult,
} from "@/server/services/admin/inventory";
import { adjustVariantStock, type PrimaryStockLevel } from "@/server/services/admin/stock";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const INVENTORY_PATH = "/admin/inventory";

export async function adjustStockAction(input: unknown): Promise<ActionResult<PrimaryStockLevel>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("stock:update");
    const parsed = stockAdjustSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    const result = await adjustVariantStock(
      parsed.data.variantId,
      parsed.data.quantity,
      parsed.data.reason,
      actor,
      parsed.data.note,
    );
    revalidatePath(INVENTORY_PATH);
    revalidatePath("/admin/products");
    return result;
  });
}

export async function bulkAdjustStockAction(
  input: unknown,
): Promise<ActionResult<BulkStockAdjustResult>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("stock:update");
    const parsed = bulkStockAdjustSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    const result = await bulkAdjustStock(
      parsed.data.items,
      parsed.data.reason,
      parsed.data.note,
      actor,
    );
    revalidatePath(INVENTORY_PATH);
    revalidatePath("/admin/products");
    return result;
  });
}

export async function getStockHistoryAction(
  variantId: string,
  page?: number,
): Promise<ActionResult<StockHistoryResult>> {
  return runAdminAction(async () => {
    await requireAdminPermission("stock:update");
    return getStockHistoryForVariant(variantId, page);
  });
}
