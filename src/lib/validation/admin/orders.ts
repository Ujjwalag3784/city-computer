/**
 * `/admin/orders` — docs/17-ROADMAP-PHASES.md Phase 7's admin order
 * management dashboard. Same shape as `validation/admin/inventory.ts`'s
 * list-query schema.
 */
import { z } from "zod";
import { OrderStatus } from "@/generated/prisma/client";

export const adminOrderFilterSchema = z.enum(["all", "needs-review", "paid-not-sent", "cancelled"]);
export type AdminOrderFilterInput = z.infer<typeof adminOrderFilterSchema>;

export const adminOrderPaymentMethodSchema = z.enum(["cod", "bank_transfer"]);
export type AdminOrderPaymentMethodInput = z.infer<typeof adminOrderPaymentMethodSchema>;

export const adminOrderListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  filter: adminOrderFilterSchema.default("all"),
  paymentMethod: adminOrderPaymentMethodSchema.optional(),
  page: z.number().int().min(1).default(1),
});
export type AdminOrderListQueryInput = z.infer<typeof adminOrderListQuerySchema>;

/** Backs every transition button on `/admin/orders/[id]` — `to` is validated against the real enum here, but whether the *specific* `from -> to` edge is legal for this admin's role is `order-state-machine.ts`'s job, not this schema's. */
export const transitionOrderSchema = z.object({
  orderId: z.string().min(1),
  to: z.nativeEnum(OrderStatus),
  note: z.string().trim().max(500).optional(),
});
export type TransitionOrderInput = z.infer<typeof transitionOrderSchema>;

export const rejectBankTransferSchema = z.object({
  paymentId: z.string().min(1),
  reason: z.string().trim().min(1, "Enter a reason.").max(500),
});
export type RejectBankTransferInput = z.infer<typeof rejectBankTransferSchema>;
