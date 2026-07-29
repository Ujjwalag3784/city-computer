/**
 * `ServiceTicket.status` state machine — docs/06-DATA-MODEL.md §9's flow:
 * `RECEIVED -> DIAGNOSING -> QUOTE_SENT -> AWAITING_APPROVAL ->
 * APPROVED|DECLINED -> IN_REPAIR -> AWAITING_PARTS -> READY_FOR_PICKUP ->
 * COLLECTED | CANCELLED`. Same "exactly one write primitive, transition
 * table + append-only event log in one transaction" shape as
 * `commerce/order-state-machine.ts` — `TicketEvent` is this file's
 * `OrderStatusEvent` equivalent.
 *
 * Simpler than the order machine: repair jobs have one actor type worth
 * distinguishing (staff vs. nobody — there's no customer- or gateway-
 * initiated transition here), so `TICKET_TRANSITIONS` is just a from/to
 * adjacency list, not a per-edge actor allowlist.
 */
import "server-only";
import { db } from "@/server/db";
import { TicketStatus } from "@/generated/prisma/client";
import { NotFoundError, AppError } from "@/lib/errors";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import { buildTicketStatusMessage, queueTicketNotification } from "./ticket-notifications";

const TICKET_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.RECEIVED]: [TicketStatus.DIAGNOSING, TicketStatus.CANCELLED],
  [TicketStatus.DIAGNOSING]: [
    TicketStatus.QUOTE_SENT,
    TicketStatus.IN_REPAIR,
    TicketStatus.CANCELLED,
  ],
  [TicketStatus.QUOTE_SENT]: [TicketStatus.AWAITING_APPROVAL, TicketStatus.CANCELLED],
  [TicketStatus.AWAITING_APPROVAL]: [TicketStatus.APPROVED, TicketStatus.DECLINED],
  [TicketStatus.APPROVED]: [TicketStatus.IN_REPAIR, TicketStatus.CANCELLED],
  [TicketStatus.DECLINED]: [TicketStatus.READY_FOR_PICKUP, TicketStatus.CANCELLED],
  [TicketStatus.IN_REPAIR]: [
    TicketStatus.AWAITING_PARTS,
    TicketStatus.READY_FOR_PICKUP,
    TicketStatus.CANCELLED,
  ],
  [TicketStatus.AWAITING_PARTS]: [TicketStatus.IN_REPAIR, TicketStatus.CANCELLED],
  [TicketStatus.READY_FOR_PICKUP]: [TicketStatus.COLLECTED],
  [TicketStatus.COLLECTED]: [],
  [TicketStatus.CANCELLED]: [],
};

export function availableTicketTransitions(from: TicketStatus): TicketStatus[] {
  // eslint-disable-next-line security/detect-object-injection -- `from` is a `TicketStatus` enum value, never arbitrary input.
  return TICKET_TRANSITIONS[from];
}

export async function applyTicketTransition(
  ticketId: string,
  to: TicketStatus,
  actor: AuditActor & { id: string },
  note?: string,
): Promise<void> {
  const ticket = await db.serviceTicket.findUnique({ where: { id: ticketId } });
  if (!ticket) throw new NotFoundError("Repair job");

  const allowed = availableTicketTransitions(ticket.status);
  if (!allowed.includes(to)) {
    throw new AppError(
      "CONFLICT_VERSION",
      `A repair job can't move from ${ticket.status} to ${to}.`,
    );
  }

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.serviceTicket.update({
      where: { id: ticketId },
      data: {
        status: to,
        completedAt: to === TicketStatus.READY_FOR_PICKUP ? now : ticket.completedAt,
        collectedAt: to === TicketStatus.COLLECTED ? now : ticket.collectedAt,
      },
    });
    await tx.ticketEvent.create({
      data: {
        ticketId,
        fromStatus: ticket.status,
        toStatus: to,
        note: note ?? null,
        isCustomerVisible: true,
        actorId: actor.id,
      },
    });
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "service_ticket.status_changed",
    entityType: "ServiceTicket",
    entityId: ticketId,
    before: { status: ticket.status },
    after: { status: to },
  });

  // Ticket notifications (docs/17 Phase 10) — queued, never blocking this
  // transition on a slow/failed notification write; see
  // `ticket-notifications.ts`'s own doc comment for why this queues a real
  // `Job` row rather than sending anything directly (no SMS/email provider
  // exists in this codebase). Prefers email when the customer gave one,
  // same "email if we have it, else SMS" precedent as every other guest
  // contact-preference fallback in this codebase.
  const message = buildTicketStatusMessage(ticket.ticketNumber, to, ticket.name);
  if (ticket.email) {
    await queueTicketNotification(ticketId, "email", ticket.email, message);
  } else {
    await queueTicketNotification(ticketId, "sms", ticket.phone, message);
  }
}
