/**
 * `/admin/inventory` — docs/09-ADMIN-DAD-MODE.md §6 "Stock management".
 * Distinct from `validation/admin/product.ts`'s `quickStockUpdateSchema`
 * (the product list's bare inline cell, no room for a reason picker,
 * fixed `CORRECTION` default): every schema here carries a real,
 * required `reason`, matching §6's "There is no way to change stock
 * without a recorded reason" applied to a screen that actually has room
 * for the reason picker.
 */
import { z } from "zod";
import { StockMovementReason } from "@/generated/prisma/client";

export const stockListFilterSchema = z.enum(["all", "low-stock", "out-of-stock"]);
export type StockListFilter = z.infer<typeof stockListFilterSchema>;

export const stockListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  filter: stockListFilterSchema.default("all"),
  page: z.number().int().min(1).default(1),
});
export type StockListQuery = z.infer<typeof stockListQuerySchema>;

/** The single-row "Set…" dialog (`StockAdjuster`, reused from Phase 2) and the −1/+1 quick buttons, which route through the exact same dialog — see that component's own doc comment for why. */
export const stockAdjustSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(0, "Enter how many you have."),
  reason: z.nativeEnum(StockMovementReason),
  note: z.string().trim().max(300).optional(),
});
export type StockAdjustInput = z.infer<typeof stockAdjustSchema>;

/**
 * docs/09 §6 "Bulk update": "a list of rows with quantity inputs, one
 * 'Save all' at the bottom." One reason/note for the whole batch, not
 * per row — a documented simplification (the doc doesn't specify per-row
 * reasons for this screen, unlike the single-row dialog), since a bulk
 * edit is realistically one event ("Friday stock count", "container
 * arrived") the owner would give one reason for anyway.
 */
export const bulkStockAdjustSchema = z.object({
  items: z
    .array(z.object({ variantId: z.string().min(1), quantity: z.number().int().min(0) }))
    .min(1)
    .max(200),
  reason: z.nativeEnum(StockMovementReason),
  note: z.string().trim().max(300).optional(),
});
export type BulkStockAdjustInput = z.infer<typeof bulkStockAdjustSchema>;
