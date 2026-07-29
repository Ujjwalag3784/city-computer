/**
 * `/admin/settings/*` — docs/09-ADMIN-DAD-MODE.md §3, OWNER only. Reads/
 * writes the existing generic `Setting` key/value store (docs/06 §10:
 * "Typed accessor layer; never raw string lookups").
 */
import { z } from "zod";

export const updateSettingSchema = z.object({
  key: z.string().min(1),
  /** Raw string from the form — coerced to the setting's own `dataType` server-side, never trusted as already-typed. */
  rawValue: z.string(),
});
export type UpdateSettingInput = z.infer<typeof updateSettingSchema>;

export const updateShippingRateSchema = z.object({
  rateId: z.string().min(1),
  basePriceRupees: z.coerce.number().int().min(0),
  estimatedDaysMin: z.coerce.number().int().min(0),
  estimatedDaysMax: z.coerce.number().int().min(0),
});
