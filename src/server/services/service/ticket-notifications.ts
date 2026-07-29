/**
 * Ticket notifications (docs/17 Phase 10: "service booking... sends a
 * notification"). No SMS/email provider exists anywhere in this codebase
 * — `PROGRESS.md`'s Phase 7 and Phase 9 sections both flag this as a
 * known, deliberate gap (Mailpit is wired in `docker-compose.yml`, but
 * nothing in application code sends through it).
 *
 * Rather than fake a send, this queues a real, durable `Job` row (the
 * existing `Job` model, docs/06 §10, "Backs the cron-table queue driver" —
 * already real, just previously unused by anything in this codebase) with
 * the message that *would* be sent. This is genuinely useful, testable
 * work — a future pass can add a worker that drains `type:
 * "ticket_notification"` jobs through a real SMS/email provider without
 * touching any of the call sites below — rather than a a no-op stub. Same
 * honesty precedent as Phase 6's stock-reservation-release job: "real and
 * tested... just not called by anything yet" (there, nothing called it;
 * here, the job itself is the thing not yet consumed).
 */
import "server-only";
import { db } from "@/server/db";
import { TicketStatus } from "@/generated/prisma/client";
import { logger } from "@/lib/logger";

export type NotificationChannel = "sms" | "email";

const STATUS_MESSAGE: Record<TicketStatus, string> = {
  [TicketStatus.RECEIVED]: "we've received your device and logged it as {ticketNumber}.",
  [TicketStatus.DIAGNOSING]: "our technician has started diagnosing your device ({ticketNumber}).",
  [TicketStatus.QUOTE_SENT]:
    "we've sent a repair quote for your device ({ticketNumber}). Please check and approve it.",
  [TicketStatus.AWAITING_APPROVAL]:
    "we're waiting for you to approve the repair quote for {ticketNumber}.",
  [TicketStatus.APPROVED]:
    "thanks — your repair quote for {ticketNumber} is approved and work will begin.",
  [TicketStatus.DECLINED]:
    "the repair quote for {ticketNumber} was declined. Please contact us to arrange collection.",
  [TicketStatus.IN_REPAIR]: "your device ({ticketNumber}) is now being repaired.",
  [TicketStatus.AWAITING_PARTS]:
    "your repair ({ticketNumber}) is waiting on a part — we'll update you once it arrives.",
  [TicketStatus.READY_FOR_PICKUP]: "good news — your device ({ticketNumber}) is ready for pickup!",
  [TicketStatus.COLLECTED]: "thanks for collecting your device ({ticketNumber}).",
  [TicketStatus.CANCELLED]: "your repair job ({ticketNumber}) has been cancelled.",
};

/** Pure — no DB — so it's directly unit-testable. */
export function buildTicketStatusMessage(
  ticketNumber: string,
  status: TicketStatus,
  customerName: string,
): string {
  // eslint-disable-next-line security/detect-object-injection -- `status` is a `TicketStatus` enum member, not arbitrary input; `STATUS_MESSAGE` has one entry per enum value.
  const template = STATUS_MESSAGE[status];
  return `Hi ${customerName}, ${template.replace("{ticketNumber}", ticketNumber)}`;
}

/**
 * Creates the `Job` row. Deliberately never throws to its caller on
 * failure — the same "observability/notification can't break the real
 * mutation" rule `recordAuditLog` already follows in this codebase — a
 * failed queue write is logged and swallowed, not surfaced.
 */
export async function queueTicketNotification(
  ticketId: string,
  channel: NotificationChannel,
  recipient: string,
  message: string,
): Promise<void> {
  try {
    await db.job.create({
      data: {
        type: "ticket_notification",
        payload: { ticketId, channel, recipient, message },
        runAt: new Date(),
      },
    });
  } catch (error) {
    logger.error(
      { error, ticketId },
      "queueTicketNotification: failed to queue — no notification sent",
    );
  }
}
