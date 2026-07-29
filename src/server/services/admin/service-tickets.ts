/**
 * `/admin/service` ("Repair jobs") — list/detail/create over
 * `ServiceTicket`, plus the one narrow mutation this file owns beyond
 * status transitions (`updateTicketInternalNotes`; transitions themselves
 * live in `service/ticket-state-machine.ts`, mirroring how `admin/orders.ts`
 * leaves `Order.status` writes to `order-state-machine.ts`).
 */
import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { TicketStatus } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import { generateTicketNumber } from "@/server/services/service/ticket-number";
import type {
  AdminTicketFilter,
  AdminTicketListQuery,
  CreateTicketInput,
} from "@/lib/validation/admin/service-tickets";

const NEEDS_ATTENTION_STATUSES: TicketStatus[] = [
  TicketStatus.RECEIVED,
  TicketStatus.DIAGNOSING,
  TicketStatus.QUOTE_SENT,
  TicketStatus.AWAITING_APPROVAL,
  TicketStatus.APPROVED,
  TicketStatus.IN_REPAIR,
  TicketStatus.AWAITING_PARTS,
];

export interface AdminTicketListItem {
  id: string;
  ticketNumber: string;
  name: string;
  phone: string;
  deviceType: string;
  brand: string;
  model: string | null;
  status: TicketStatus;
  priority: string;
  branchName: string;
  receivedAt: Date;
}

const TICKET_LIST_PAGE_SIZE = 20;

function buildListWhere(query: AdminTicketListQuery): Prisma.ServiceTicketWhereInput {
  const clauses: Prisma.ServiceTicketWhereInput[] = [];
  if (query.q) {
    clauses.push({
      OR: [
        { ticketNumber: { contains: query.q, mode: "insensitive" } },
        { name: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q } },
        { brand: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  const filter: AdminTicketFilter = query.filter;
  if (filter === "needs-attention") clauses.push({ status: { in: NEEDS_ATTENTION_STATUSES } });
  else if (filter === "ready-for-pickup") clauses.push({ status: TicketStatus.READY_FOR_PICKUP });
  else if (filter === "collected") clauses.push({ status: TicketStatus.COLLECTED });
  else if (filter === "cancelled") clauses.push({ status: TicketStatus.CANCELLED });
  return clauses.length > 0 ? { AND: clauses } : {};
}

export async function listTicketsForAdmin(
  query: AdminTicketListQuery,
): Promise<{ items: AdminTicketListItem[]; total: number; hasNext: boolean }> {
  const where = buildListWhere(query);
  const [rows, total] = await Promise.all([
    db.serviceTicket.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      skip: (query.page - 1) * TICKET_LIST_PAGE_SIZE,
      take: TICKET_LIST_PAGE_SIZE + 1,
      include: { branch: { select: { name: true } } },
    }),
    db.serviceTicket.count({ where }),
  ]);
  const hasNext = rows.length > TICKET_LIST_PAGE_SIZE;
  return {
    items: rows.slice(0, TICKET_LIST_PAGE_SIZE).map((t) => ({
      id: t.id,
      ticketNumber: t.ticketNumber,
      name: t.name,
      phone: t.phone,
      deviceType: t.deviceType,
      brand: t.brand,
      model: t.model,
      status: t.status,
      priority: t.priority,
      branchName: t.branch.name,
      receivedAt: t.receivedAt,
    })),
    total,
    hasNext,
  };
}

export interface AdminTicketEvent {
  id: string;
  fromStatus: TicketStatus | null;
  toStatus: TicketStatus;
  note: string | null;
  actorName: string | null;
  createdAt: Date;
}

export interface AdminTicketDetail {
  id: string;
  ticketNumber: string;
  name: string;
  phone: string;
  email: string | null;
  branchName: string;
  deviceType: string;
  brand: string;
  model: string | null;
  serialNumber: string | null;
  issueCategory: string;
  issueDescription: string;
  accessoriesReceived: string[];
  status: TicketStatus;
  priority: string;
  assignedToName: string | null;
  estimatedCostPaisa: number | null;
  finalCostPaisa: number | null;
  warrantyClaim: boolean;
  internalNotes: string | null;
  receivedAt: Date;
  completedAt: Date | null;
  collectedAt: Date | null;
  events: AdminTicketEvent[];
}

export async function getTicketForAdmin(ticketId: string): Promise<AdminTicketDetail> {
  const ticket = await db.serviceTicket.findUnique({
    where: { id: ticketId },
    include: {
      branch: { select: { name: true } },
      assignedTo: { select: { name: true, email: true } },
      events: {
        orderBy: { createdAt: "desc" },
        include: { actor: { select: { name: true, email: true } } },
      },
    },
  });
  if (!ticket) throw new NotFoundError("Repair job");

  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    name: ticket.name,
    phone: ticket.phone,
    email: ticket.email,
    branchName: ticket.branch.name,
    deviceType: ticket.deviceType,
    brand: ticket.brand,
    model: ticket.model,
    serialNumber: ticket.serialNumber,
    issueCategory: ticket.issueCategory,
    issueDescription: ticket.issueDescription,
    accessoriesReceived: ticket.accessoriesReceived,
    status: ticket.status,
    priority: ticket.priority,
    assignedToName: ticket.assignedTo?.name ?? ticket.assignedTo?.email ?? null,
    estimatedCostPaisa: ticket.estimatedCostPaisa,
    finalCostPaisa: ticket.finalCostPaisa,
    warrantyClaim: ticket.warrantyClaim,
    internalNotes: ticket.internalNotes,
    receivedAt: ticket.receivedAt,
    completedAt: ticket.completedAt,
    collectedAt: ticket.collectedAt,
    events: ticket.events.map((e) => ({
      id: e.id,
      fromStatus: e.fromStatus,
      toStatus: e.toStatus,
      note: e.note,
      actorName: e.actor?.name ?? e.actor?.email ?? null,
      createdAt: e.createdAt,
    })),
  };
}

export async function createTicket(
  input: CreateTicketInput,
  actor: AuditActor,
): Promise<{ id: string; ticketNumber: string }> {
  const now = new Date();
  const ticketNumber = await generateTicketNumber(now);

  const ticket = await db.serviceTicket.create({
    data: {
      ticketNumber,
      name: input.name.trim(),
      phone: input.phone.trim(),
      email: input.email ? input.email.trim() : null,
      branchId: input.branchId,
      deviceType: input.deviceType,
      brand: input.brand.trim(),
      model: input.model?.trim() || null,
      serialNumber: input.serialNumber?.trim() || null,
      issueCategory: input.issueCategory.trim(),
      issueDescription: input.issueDescription.trim(),
      accessoriesReceived: input.accessoriesReceived,
      priority: input.priority,
      warrantyClaim: input.warrantyClaim,
      receivedAt: now,
    },
  });

  await db.ticketEvent.create({
    data: {
      ticketId: ticket.id,
      fromStatus: null,
      toStatus: TicketStatus.RECEIVED,
      note: "Device received",
      isCustomerVisible: true,
      actorId: actor.id,
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "service_ticket.created",
    entityType: "ServiceTicket",
    entityId: ticket.id,
    after: { ticketNumber, brand: ticket.brand, deviceType: ticket.deviceType },
  });

  return { id: ticket.id, ticketNumber };
}

export async function updateTicketInternalNotes(
  ticketId: string,
  internalNotes: string,
  actor: AuditActor,
): Promise<void> {
  const before = await db.serviceTicket.findUnique({
    where: { id: ticketId },
    select: { internalNotes: true },
  });
  if (!before) throw new NotFoundError("Repair job");

  const trimmed = internalNotes.trim();
  await db.serviceTicket.update({
    where: { id: ticketId },
    data: { internalNotes: trimmed || null },
  });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "service_ticket.notes_updated",
    entityType: "ServiceTicket",
    entityId: ticketId,
    before: { internalNotes: before.internalNotes },
    after: { internalNotes: trimmed || null },
  });
}
