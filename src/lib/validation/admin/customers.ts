/**
 * `/admin/customers` — docs/09-ADMIN-DAD-MODE.md §3 module map + §12
 * "Customer support... can view orders and customers." Mirrors the shape
 * of `validation/admin/orders.ts`: a list-query schema plus one schema per
 * mutation, both zod-parsed at the Server Action boundary before the
 * service layer ever sees the input.
 */
import { z } from "zod";

export const ADMIN_CUSTOMER_FILTERS = ["all", "cod-blocked", "new-this-week"] as const;
export type AdminCustomerFilter = (typeof ADMIN_CUSTOMER_FILTERS)[number];

export const adminCustomerListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  filter: z.enum(ADMIN_CUSTOMER_FILTERS).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});
export type AdminCustomerListQuery = z.infer<typeof adminCustomerListQuerySchema>;

export const setCustomerCodBlockedSchema = z.object({
  customerId: z.string().min(1),
  blocked: z.boolean(),
  /** Required for both directions — docs/09 §8's "reason required on every change" applies just as much to lifting a block as imposing one; an owner unblocking someone should also leave a trail of why. */
  reason: z.string().trim().min(3, "Tell us why, in a few words.").max(500),
});
export type SetCustomerCodBlockedInput = z.infer<typeof setCustomerCodBlockedSchema>;

export const updateCustomerNotesSchema = z.object({
  customerId: z.string().min(1),
  notes: z.string().trim().max(4000),
});
export type UpdateCustomerNotesInput = z.infer<typeof updateCustomerNotesSchema>;
