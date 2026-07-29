import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, AppError } from "@/lib/errors";
import { TicketStatus } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    serviceTicket: { findUnique: vi.fn(), update: vi.fn() },
    ticketEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("../admin/audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("../admin/audit-log");
const { availableTicketTransitions, applyTicketTransition } = await import(
  "./ticket-state-machine"
);

const ACTOR = { id: "user_tech", email: "tech@citycomputer.com.np" };

beforeEach(() => {
  vi.mocked(db.serviceTicket.findUnique).mockReset();
  vi.mocked(db.serviceTicket.update).mockReset();
  vi.mocked(db.ticketEvent.create).mockReset();
  vi.mocked(db.$transaction).mockReset();
  vi.mocked(recordAuditLog).mockClear();
});

describe("availableTicketTransitions", () => {
  it("allows RECEIVED to move to DIAGNOSING or CANCELLED", () => {
    expect(availableTicketTransitions(TicketStatus.RECEIVED)).toEqual([
      TicketStatus.DIAGNOSING,
      TicketStatus.CANCELLED,
    ]);
  });

  it("has no transitions out of a terminal status", () => {
    expect(availableTicketTransitions(TicketStatus.COLLECTED)).toEqual([]);
    expect(availableTicketTransitions(TicketStatus.CANCELLED)).toEqual([]);
  });
});

describe("applyTicketTransition", () => {
  it("throws NotFoundError for a missing ticket", async () => {
    vi.mocked(db.serviceTicket.findUnique).mockResolvedValue(null as never);

    await expect(
      applyTicketTransition("missing", TicketStatus.DIAGNOSING, ACTOR),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("rejects a transition not in the table", async () => {
    vi.mocked(db.serviceTicket.findUnique).mockResolvedValue({
      id: "t1",
      status: TicketStatus.RECEIVED,
      completedAt: null,
      collectedAt: null,
    } as never);

    await expect(applyTicketTransition("t1", TicketStatus.COLLECTED, ACTOR)).rejects.toBeInstanceOf(
      AppError,
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("writes the status update and a TicketEvent in one transaction, then records an audit log entry", async () => {
    vi.mocked(db.serviceTicket.findUnique).mockResolvedValue({
      id: "t1",
      status: TicketStatus.RECEIVED,
      completedAt: null,
      collectedAt: null,
    } as never);
    vi.mocked(db.$transaction).mockImplementation((fn: unknown) =>
      (fn as (tx: typeof db) => Promise<unknown>)(db),
    );
    vi.mocked(db.serviceTicket.update).mockResolvedValue({} as never);
    vi.mocked(db.ticketEvent.create).mockResolvedValue({} as never);

    await applyTicketTransition("t1", TicketStatus.DIAGNOSING, ACTOR, "Started diagnosis");

    expect(db.serviceTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t1" },
        data: expect.objectContaining({ status: TicketStatus.DIAGNOSING }),
      }),
    );
    expect(db.ticketEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: "t1",
          fromStatus: TicketStatus.RECEIVED,
          toStatus: TicketStatus.DIAGNOSING,
          note: "Started diagnosis",
        }),
      }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "service_ticket.status_changed" }),
    );
  });
});
