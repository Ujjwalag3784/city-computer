/**
 * Public service-desk booking + status lookup (docs/17 Phase 10). Kept as
 * its own file rather than added to `admin/service-tickets.ts` — that
 * file's `createTicket` requires a real staff `AuditActor` (used when a
 * staff member logs a walk-in repair on a customer's behalf); a public,
 * unauthenticated booking has no such actor, so this is a genuinely
 * different write path, not a thin wrapper around the same function.
 *
 * The public status lookup (`getPublicTicketStatus`) is the security-
 * sensitive half: docs/06 §9's own schema comment requires "ticket number
 * plus the last 4 digits of the phone... otherwise ticket numbers are
 * enumerable." Wrong ticket number and right-ticket-wrong-phone both throw
 * the exact same `NotFoundError` message — the same enumeration-resistance
 * principle `auth/verify-email.ts` already applies to token validity,
 * applied here to ticket lookup.
 */
import "server-only";
import { db } from "@/server/db";
import { ServiceDeviceType, TicketStatus } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { lastFourDigits } from "@/lib/nepal";
import { generateTicketNumber } from "@/server/services/service/ticket-number";
import {
  buildTicketStatusMessage,
  queueTicketNotification,
} from "@/server/services/service/ticket-notifications";
import type { BookServiceTicketInput } from "@/lib/validation/service";

export interface BookServiceTicketResult {
  ticketNumber: string;
}

export async function createPublicServiceTicket(
  input: BookServiceTicketInput,
): Promise<BookServiceTicketResult> {
  const branch = await db.branch.findFirst({ where: { slug: input.branchSlug, isActive: true } });
  if (!branch) throw new NotFoundError("Store");

  const now = new Date();
  const ticketNumber = await generateTicketNumber(now);

  const ticket = await db.serviceTicket.create({
    data: {
      ticketNumber,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email ? input.email.trim() : null,
      branchId: branch.id,
      deviceType: input.deviceType,
      brand: input.brand.trim(),
      model: input.model?.trim() || null,
      serialNumber: input.serialNumber?.trim() || null,
      issueCategory: input.issueCategory.trim(),
      issueDescription: input.issueDescription.trim(),
      accessoriesReceived: input.accessoriesReceived,
      warrantyClaim: input.warrantyClaim,
      receivedAt: now,
    },
  });

  // `actorId: null` — a customer's own booking has no staff actor, unlike
  // `admin/service-tickets.ts`'s `createTicket` (which always has one).
  await db.ticketEvent.create({
    data: {
      ticketId: ticket.id,
      fromStatus: null,
      toStatus: TicketStatus.RECEIVED,
      note: "Booked online by the customer",
      isCustomerVisible: true,
      actorId: null,
    },
  });

  await db.auditLog.create({
    data: {
      actorId: null,
      actorEmail: null,
      action: "service_ticket.created_by_customer",
      entityType: "ServiceTicket",
      entityId: ticket.id,
      after: { ticketNumber, brand: ticket.brand, deviceType: ticket.deviceType },
    },
  });

  const message = buildTicketStatusMessage(ticketNumber, TicketStatus.RECEIVED, ticket.name);
  if (ticket.email) {
    await queueTicketNotification(ticket.id, "email", ticket.email, message);
  } else {
    await queueTicketNotification(ticket.id, "sms", ticket.phone, message);
  }

  return { ticketNumber };
}

export interface PublicTicketEvent {
  toStatus: TicketStatus;
  note: string | null;
  createdAt: Date;
}

export interface PublicTicketStatus {
  ticketNumber: string;
  status: TicketStatus;
  deviceType: ServiceDeviceType;
  brand: string;
  model: string | null;
  branchName: string;
  branchAddress: string;
  estimatedReadyAt: Date | null;
  receivedAt: Date;
  events: PublicTicketEvent[];
}

/** Same `NotFoundError` for "no such ticket" and "wrong phone digits" — see this file's own doc comment. */
export async function getPublicTicketStatus(
  ticketNumber: string,
  phoneLastFour: string,
): Promise<PublicTicketStatus> {
  const notFound = () => new NotFoundError("Repair ticket");

  const ticket = await db.serviceTicket.findUnique({
    where: { ticketNumber },
    include: {
      branch: { select: { name: true, addressLine: true } },
      events: {
        where: { isCustomerVisible: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!ticket) throw notFound();

  const actualLastFour = lastFourDigits(ticket.phone);
  if (!actualLastFour || actualLastFour !== phoneLastFour) throw notFound();

  return {
    ticketNumber: ticket.ticketNumber,
    status: ticket.status,
    deviceType: ticket.deviceType,
    brand: ticket.brand,
    model: ticket.model,
    branchName: ticket.branch.name,
    branchAddress: ticket.branch.addressLine,
    estimatedReadyAt: ticket.estimatedReadyAt,
    receivedAt: ticket.receivedAt,
    events: ticket.events.map((e) => ({
      toStatus: e.toStatus,
      note: e.note,
      createdAt: e.createdAt,
    })),
  };
}
