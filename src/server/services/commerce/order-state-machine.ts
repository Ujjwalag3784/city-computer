/**
 * The `Order.status` state machine — docs/17-ROADMAP-PHASES.md Phase 7:
 * "`Order` state machine with declarative transitions." Every status
 * change in this codebase goes through `applyOrderTransition` below; there
 * is no other place that writes `Order.status` directly, matching the
 * same "exactly one write primitive" discipline `admin/stock.ts`'s
 * `adjustVariantStock` established for stock.
 *
 * `OrderStatusEvent` (docs/06 §6: "APPEND-ONLY. Powers the visual tracker
 * and the undo window.") is this state machine's own audit trail — every
 * transition writes one, in the same transaction as the `Order.status`
 * update, so the two can never disagree.
 */
import "server-only";
import { db } from "@/server/db";
import { OrderStatus, OrderActorType } from "@/generated/prisma/client";
import type { Order, Prisma } from "@/generated/prisma/client";
import { AppError, NotFoundError } from "@/lib/errors";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";

export interface OrderTransitionRule {
  from: OrderStatus;
  to: OrderStatus;
  /** Which kinds of actor may perform this specific transition. */
  allowedActorTypes: OrderActorType[];
}

/**
 * The full transition table — docs/06 §6's status list
 * (`PENDING_PAYMENT|PAYMENT_FAILED|CONFIRMED|PREPARING|PACKED|SHIPPED|
 * DELIVERED|COMPLETED|CANCELLED|RETURN_REQUESTED|RETURNED|REFUNDED`), with
 * every edge this codebase's own flows actually need. `GATEWAY` is kept as
 * an allowed actor on the payment-outcome edges even though no online
 * gateway is wired yet this pass (COD/bank transfer only) — a future
 * eSewa/Khalti webhook handler is a `GATEWAY` actor by definition, and
 * adding it to the table now means that phase doesn't have to touch this
 * file's shape, only add a caller.
 */
const ORDER_TRANSITIONS: OrderTransitionRule[] = [
  {
    from: OrderStatus.PENDING_PAYMENT,
    to: OrderStatus.CONFIRMED,
    allowedActorTypes: [OrderActorType.SYSTEM, OrderActorType.ADMIN, OrderActorType.GATEWAY],
  },
  {
    from: OrderStatus.PENDING_PAYMENT,
    to: OrderStatus.PAYMENT_FAILED,
    allowedActorTypes: [OrderActorType.SYSTEM, OrderActorType.ADMIN, OrderActorType.GATEWAY],
  },
  {
    from: OrderStatus.PENDING_PAYMENT,
    to: OrderStatus.CANCELLED,
    allowedActorTypes: [OrderActorType.CUSTOMER, OrderActorType.ADMIN, OrderActorType.SYSTEM],
  },
  {
    from: OrderStatus.PAYMENT_FAILED,
    to: OrderStatus.PENDING_PAYMENT,
    allowedActorTypes: [OrderActorType.CUSTOMER, OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.PAYMENT_FAILED,
    to: OrderStatus.CANCELLED,
    allowedActorTypes: [OrderActorType.CUSTOMER, OrderActorType.ADMIN, OrderActorType.SYSTEM],
  },
  {
    from: OrderStatus.CONFIRMED,
    to: OrderStatus.PREPARING,
    allowedActorTypes: [OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.CONFIRMED,
    to: OrderStatus.CANCELLED,
    allowedActorTypes: [OrderActorType.CUSTOMER, OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.PREPARING,
    to: OrderStatus.PACKED,
    allowedActorTypes: [OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.PREPARING,
    to: OrderStatus.CANCELLED,
    allowedActorTypes: [OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.PACKED,
    to: OrderStatus.SHIPPED,
    allowedActorTypes: [OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.PACKED,
    to: OrderStatus.CANCELLED,
    allowedActorTypes: [OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.SHIPPED,
    to: OrderStatus.DELIVERED,
    allowedActorTypes: [OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.DELIVERED,
    to: OrderStatus.COMPLETED,
    allowedActorTypes: [OrderActorType.ADMIN, OrderActorType.SYSTEM],
  },
  {
    from: OrderStatus.DELIVERED,
    to: OrderStatus.RETURN_REQUESTED,
    allowedActorTypes: [OrderActorType.CUSTOMER, OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.COMPLETED,
    to: OrderStatus.RETURN_REQUESTED,
    allowedActorTypes: [OrderActorType.CUSTOMER, OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.RETURN_REQUESTED,
    to: OrderStatus.RETURNED,
    allowedActorTypes: [OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.RETURN_REQUESTED,
    to: OrderStatus.COMPLETED,
    allowedActorTypes: [OrderActorType.ADMIN],
  },
  {
    from: OrderStatus.RETURNED,
    to: OrderStatus.REFUNDED,
    allowedActorTypes: [OrderActorType.ADMIN],
  },
];

/** `CANCELLED`/`REFUNDED` have no outgoing edges in the table above — nothing else in docs/06's status list is reachable from them. */
const TERMINAL_STATUSES: OrderStatus[] = [OrderStatus.CANCELLED, OrderStatus.REFUNDED];

export function isTerminalOrderStatus(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function findTransitionRule(
  from: OrderStatus,
  to: OrderStatus,
): OrderTransitionRule | undefined {
  return ORDER_TRANSITIONS.find((rule) => rule.from === from && rule.to === to);
}

/** Every status this actor type could legally move an order in `from` to right now — what an admin "transition buttons" UI renders. */
export function availableTransitions(from: OrderStatus, actorType: OrderActorType): OrderStatus[] {
  return ORDER_TRANSITIONS.filter(
    (rule) => rule.from === from && rule.allowedActorTypes.includes(actorType),
  ).map((rule) => rule.to);
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  actorType: OrderActorType,
): boolean {
  const rule = findTransitionRule(from, to);
  return rule !== undefined && rule.allowedActorTypes.includes(actorType);
}

/**
 * Timestamp column set alongside each destination status, per docs/06 §6's
 * `Order` field table (`confirmedAt`, `shippedAt`, `deliveredAt`,
 * `completedAt`, `cancelledAt`). Statuses with no dedicated timestamp
 * column (`PREPARING`, `PACKED`, `PAYMENT_FAILED`, `RETURN_REQUESTED`,
 * `RETURNED`, `REFUNDED`) rely on `OrderStatusEvent.createdAt` instead —
 * this codebase's general "not every state needs its own denormalised
 * timestamp" convention. Returns a typed partial `Prisma.OrderUpdateInput`
 * directly (rather than a `{field, value}` pair spread via a computed
 * property) so this stays checked against the real column set at compile
 * time instead of widening to an arbitrary string key.
 */
function timestampUpdateFor(to: OrderStatus): Prisma.OrderUpdateInput {
  const now = new Date();
  switch (to) {
    case OrderStatus.CONFIRMED:
      return { confirmedAt: now };
    case OrderStatus.SHIPPED:
      return { shippedAt: now };
    case OrderStatus.DELIVERED:
      return { deliveredAt: now };
    case OrderStatus.COMPLETED:
      return { completedAt: now };
    case OrderStatus.CANCELLED:
      return { cancelledAt: now };
    default:
      return {};
  }
}

export interface TransitionActor {
  type: OrderActorType;
  id?: string | null;
  email?: string | null;
}

/**
 * The one function allowed to change `Order.status`. Validates the
 * transition against the table above, writes the new status plus its
 * timestamp column and an append-only `OrderStatusEvent` in one
 * transaction, and — only for admin-performed transitions — mirrors the
 * change into the shared `AuditLog` too (system/customer/gateway-driven
 * transitions are still fully captured by `OrderStatusEvent` itself,
 * which is this model's own purpose-built log; `AuditLog` stays scoped to
 * admin actions, matching every other admin mutation in this codebase).
 */
export async function applyOrderTransition(
  orderId: string,
  to: OrderStatus,
  actor: TransitionActor,
  note?: string,
): Promise<Order> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new NotFoundError("Order");

  const rule = findTransitionRule(order.status, to);
  if (!rule) {
    throw new AppError("CONFLICT_VERSION", `Can't move an order from ${order.status} to ${to}.`);
  }
  if (!rule.allowedActorTypes.includes(actor.type)) {
    throw new AppError("FORBIDDEN", `A ${actor.type.toLowerCase()} can't make that change.`);
  }

  const updated = await db.$transaction(async (tx) => {
    const result = await tx.order.update({
      where: { id: orderId },
      data: {
        status: to,
        ...timestampUpdateFor(to),
        ...(to === OrderStatus.CANCELLED && note ? { cancellationReason: note } : {}),
      },
    });
    await tx.orderStatusEvent.create({
      data: {
        orderId,
        fromStatus: order.status,
        toStatus: to,
        actorId: actor.id ?? null,
        actorType: actor.type,
        note: note ?? null,
      },
    });
    return result;
  });

  if (actor.type === OrderActorType.ADMIN && actor.id) {
    await recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email ?? null,
      action: "order.statusChanged",
      entityType: "Order",
      entityId: orderId,
      before: { status: order.status },
      after: { status: to, note: note ?? null },
    });
  }

  return updated;
}

/** Thin convenience wrapper for admin callers, matching `AuditActor`'s `{id, email}` shape everywhere else in the admin codebase. */
export async function applyOrderTransitionAsAdmin(
  orderId: string,
  to: OrderStatus,
  actor: AuditActor,
  note?: string,
): Promise<Order> {
  return applyOrderTransition(
    orderId,
    to,
    { type: OrderActorType.ADMIN, id: actor.id, email: actor.email },
    note,
  );
}
