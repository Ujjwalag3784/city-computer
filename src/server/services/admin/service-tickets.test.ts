import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { ServiceDeviceType, TicketPriority, TicketStatus } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    serviceTicket: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    ticketEvent: { create: vi.fn() },
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../service/ticket-number", () => ({
  generateTicketNumber: vi.fn().mockResolvedValue("SVC-2607-0001"),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { listTicketsForAdmin, createTicket, updateTicketInternalNotes } = await import(
  "./service-tickets"
);

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

const BASE_TICKET_INPUT = {
  name: "Ramesh",
  phone: "9800000000",
  branchId: "branch_1",
  deviceType: ServiceDeviceType.LAPTOP,
  brand: "HP",
  issueCategory: "Won't turn on",
  issueDescription: "Pressed the power button and nothing happens.",
  accessoriesReceived: [] as string[],
  priority: TicketPriority.NORMAL,
  warrantyClaim: false,
};

beforeEach(() => {
  vi.mocked(db.serviceTicket.findMany).mockReset();
  vi.mocked(db.serviceTicket.count).mockReset();
  vi.mocked(db.serviceTicket.findUnique).mockReset();
  vi.mocked(db.serviceTicket.create).mockReset();
  vi.mocked(db.serviceTicket.update).mockReset();
  vi.mocked(db.ticketEvent.create).mockReset();
  vi.mocked(recordAuditLog).mockClear();
});

describe("listTicketsForAdmin", () => {
  it("defaults to the needs-attention status set", async () => {
    vi.mocked(db.serviceTicket.findMany).mockResolvedValue([]);
    vi.mocked(db.serviceTicket.count).mockResolvedValue(0);

    await listTicketsForAdmin({ filter: "needs-attention", page: 1 });

    const where = vi.mocked(db.serviceTicket.findMany).mock.calls[0]?.[0]?.where as {
      AND: { status: { in: TicketStatus[] } }[];
    };
    expect(where.AND[0]?.status.in).toContain(TicketStatus.RECEIVED);
    expect(where.AND[0]?.status.in).not.toContain(TicketStatus.COLLECTED);
  });
});

describe("createTicket", () => {
  it("creates a ticket, writes the RECEIVED TicketEvent, and records an audit log entry", async () => {
    vi.mocked(db.serviceTicket.create).mockResolvedValue({
      id: "t1",
      brand: "HP",
      deviceType: "LAPTOP",
    } as never);
    vi.mocked(db.ticketEvent.create).mockResolvedValue({} as never);

    const result = await createTicket(BASE_TICKET_INPUT, ACTOR);

    expect(result).toEqual({ id: "t1", ticketNumber: "SVC-2607-0001" });
    expect(db.ticketEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: "t1",
          fromStatus: null,
          toStatus: TicketStatus.RECEIVED,
        }),
      }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "service_ticket.created" }),
    );
  });
});

describe("updateTicketInternalNotes", () => {
  it("throws NotFoundError for a missing ticket", async () => {
    vi.mocked(db.serviceTicket.findUnique).mockResolvedValue(null as never);

    await expect(updateTicketInternalNotes("missing", "note", ACTOR)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("trims whitespace and stores null for an empty note", async () => {
    vi.mocked(db.serviceTicket.findUnique).mockResolvedValue({ internalNotes: "old" } as never);
    vi.mocked(db.serviceTicket.update).mockResolvedValue({} as never);

    await updateTicketInternalNotes("t1", "   ", ACTOR);

    expect(db.serviceTicket.update).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { internalNotes: null },
    });
  });
});
