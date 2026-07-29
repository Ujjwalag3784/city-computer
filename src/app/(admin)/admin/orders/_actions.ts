"use server";

/**
 * Server Actions backing `/admin/orders` and `/admin/orders/[id]`. Same
 * shape as every other admin route's `_actions.ts` (permission check ->
 * validate -> call the service -> revalidate -> plain `ActionResult`),
 * per `admin/inventory/_actions.ts`'s own doc comment.
 *
 * Permission per action, not one blanket gate: `order:update` covers the
 * forward-moving status buttons (confirm/prepare/pack/ship/deliver/
 * complete) and marking COD cash collected; `order:cancel` and
 * `order:refund` are their own narrower permissions (STAFF holds
 * `order:update` but not `order:cancel`/`order:refund` — see
 * `prisma/seed/core.ts`'s `ROLE_GRANTS`, confirmed in this session's own
 * research pass); `payment:approve` gates both bank-transfer approve and
 * reject (rejecting a payment is also a judgement call requiring the same
 * trust level as approving it).
 */
import { revalidatePath } from "next/cache";
import { auth } from "@/server/auth";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import { OrderStatus } from "@/generated/prisma/client";
import { transitionOrderSchema, rejectBankTransferSchema } from "@/lib/validation/admin/orders";
import { db } from "@/server/db";
import { applyOrderTransitionAsAdmin } from "@/server/services/commerce/order-state-machine";
import { releaseReservation } from "@/server/services/commerce/stock-reservation";
import { markCodPaymentCollected } from "@/server/services/commerce/payments/cod";
import {
  approveBankTransfer,
  rejectBankTransfer,
} from "@/server/services/commerce/payments/bank-transfer";
import { getReceiptViewUrl } from "@/server/services/commerce/receipt-upload";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const ORDERS_LIST_PATH = "/admin/orders";

function permissionForTransition(to: OrderStatus): string {
  if (to === OrderStatus.CANCELLED) return "order:cancel";
  if (to === OrderStatus.REFUNDED) return "order:refund";
  return "order:update";
}

export async function transitionOrderAction(input: unknown): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = transitionOrderSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission(permissionForTransition(parsed.data.to));
    await applyOrderTransitionAsAdmin(parsed.data.orderId, parsed.data.to, actor, parsed.data.note);

    // `order-state-machine.ts`'s own transition write only touches
    // `Order.status`/timestamps/`OrderStatusEvent` — it doesn't know about
    // stock (same separation-of-concerns reasoning as `order.ts`'s own
    // "composed, not one mega-transaction" placement flow). Cancelling is
    // the one transition that must also give back any stock this order is
    // still holding, so that release happens here, the action layer, right
    // after the transition succeeds.
    if (parsed.data.to === OrderStatus.CANCELLED) {
      const reservations = await db.stockReservation.findMany({
        where: { orderId: parsed.data.orderId, status: "ACTIVE" },
      });
      for (const reservation of reservations) {
        await releaseReservation(reservation.id, "RELEASED");
      }
    }

    revalidatePath(ORDERS_LIST_PATH);
    revalidatePath(`${ORDERS_LIST_PATH}/${parsed.data.orderId}`);
  });
}

export async function markCodCollectedAction(
  paymentId: string,
  orderId: string,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("order:update");
    await markCodPaymentCollected(paymentId, actor);

    revalidatePath(ORDERS_LIST_PATH);
    revalidatePath(`${ORDERS_LIST_PATH}/${orderId}`);
  });
}

/** `requireAdminPermission` only returns `{id, email}` (`AuditActor`) — the OWNER-above-threshold rule inside `bank-transfer.ts`'s own `assertCanApprove` needs the session's `roleKeys` too, so this action fetches `auth()` a second time for that. See `bank-transfer.ts`'s `ApprovalActor` doc comment for why `payment:approve` alone isn't sufficient above the threshold. */
export async function approveBankTransferAction(
  paymentId: string,
  orderId: string,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("payment:approve");
    const session = await auth();
    const roleKeys = session?.user.roleKeys ?? [];
    await approveBankTransfer(paymentId, { id: actor.id, email: actor.email, roleKeys });

    revalidatePath(ORDERS_LIST_PATH);
    revalidatePath(`${ORDERS_LIST_PATH}/${orderId}`);
  });
}

export async function rejectBankTransferAction(
  input: unknown,
  orderId: string,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const parsed = rejectBankTransferSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);

    const actor = await requireAdminPermission("payment:approve");
    const session = await auth();
    const roleKeys = session?.user.roleKeys ?? [];
    await rejectBankTransfer(
      parsed.data.paymentId,
      { id: actor.id, email: actor.email, roleKeys },
      parsed.data.reason,
    );

    revalidatePath(ORDERS_LIST_PATH);
    revalidatePath(`${ORDERS_LIST_PATH}/${orderId}`);
  });
}

export interface ReceiptViewUrl {
  url: string;
}

export async function getReceiptViewUrlAction(
  mediaId: string,
): Promise<ActionResult<ReceiptViewUrl>> {
  return runAdminAction(async () => {
    await requireAdminPermission("payment:approve");
    const url = await getReceiptViewUrl(mediaId);
    return { url };
  });
}
