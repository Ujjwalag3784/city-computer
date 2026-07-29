import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { ServiceDeviceType, TicketStatus } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    branch: { findFirst: vi.fn() },
    serviceTicket: { create: vi.fn(), findUnique: vi.fn() },
    ticketEvent: { create: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock("@/server/services/service/ticket-number", () => ({
  generateTicketNumber: vi.fn().mockResolvedValue("SVC-2607-0042"),
}));

vi.mock("@/server/services/service/ticket-notifications", () => ({
  buildTicketStatusMessage: vi.fn().mockReturnValue("Hi there, ..."),
  queueTicketNotification: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { queueTicketNotification } = await import("@/server/services/service/ticket-notifications");
const { createPublicServiceTicket, getPublicTicketStatus } = await import("./public-tickets");

const BASE_BOOKING = {
  name: "Ramesh",
  phone: "+9779800000001",
  email: "",
  branchSlug: "new-road",
  deviceType: ServiceDeviceType.LAPTOP,
  brand: "HP",
  model: "Victus 15",
  serialNumber: "",
  issueCategory: "Won't turn on",
  issueDescription: "Device does not power on at all.",
  accessoriesReceived: [],
  warrantyClaim: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createPublicServiceTicket", () => {
  it("throws NotFoundError for an unknown or inactive branch", async () => {
    vi.mocked(db.branch.findFirst).mockResolvedValue(null as never);

    await expect(createPublicServiceTicket(BASE_BOOKING)).rejects.toBeInstanceOf(NotFoundError);
    expect(db.serviceTicket.create).not.toHaveBeenCalled();
  });

  it("creates the ticket with a null actorId event and audit entry, then queues a notification", async () => {
    vi.mocked(db.branch.findFirst).mockResolvedValue({ id: "branch1" } as never);
    vi.mocked(db.serviceTicket.create).mockResolvedValue({
      id: "t1",
      ticketNumber: "SVC-2607-0042",
      name: "Ramesh",
      phone: "+9779800000001",
      email: null,
      brand: "HP",
      deviceType: ServiceDeviceType.LAPTOP,
    } as never);

    const result = await createPublicServiceTicket(BASE_BOOKING);

    expect(result.ticketNumber).toBe("SVC-2607-0042");
    expect(db.ticketEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId: null, toStatus: TicketStatus.RECEIVED }),
      }),
    );
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: null,
          action: "service_ticket.created_by_customer",
        }),
      }),
    );
    expect(queueTicketNotification).toHaveBeenCalledWith(
      "t1",
      "sms",
      "+9779800000001",
      "Hi there, ...",
    );
  });

  it("prefers email over SMS when the customer gave one", async () => {
    vi.mocked(db.branch.findFirst).mockResolvedValue({ id: "branch1" } as never);
    vi.mocked(db.serviceTicket.create).mockResolvedValue({
      id: "t1",
      ticketNumber: "SVC-2607-0042",
      name: "Ramesh",
      phone: "+9779800000001",
      email: "ramesh@example.com",
      brand: "HP",
      deviceType: ServiceDeviceType.LAPTOP,
    } as never);

    await createPublicServiceTicket({ ...BASE_BOOKING, email: "ramesh@example.com" });

    expect(queueTicketNotification).toHaveBeenCalledWith(
      "t1",
      "email",
      "ramesh@example.com",
      "Hi there, ...",
    );
  });
});

describe("getPublicTicketStatus", () => {
  it("throws NotFoundError for a ticket number that doesn't exist", async () => {
    vi.mocked(db.serviceTicket.findUnique).mockResolvedValue(null as never);

    await expect(getPublicTicketStatus("SVC-2607-9999", "0001")).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws the SAME NotFoundError for a real ticket with the wrong phone digits — enumeration resistance", async () => {
    vi.mocked(db.serviceTicket.findUnique).mockResolvedValue({
      ticketNumber: "SVC-2607-0042",
      phone: "+9779800000001",
      status: TicketStatus.RECEIVED,
      deviceType: ServiceDeviceType.LAPTOP,
      brand: "HP",
      model: null,
      branch: { name: "New Road", addressLine: "Ganga Path" },
      estimatedReadyAt: null,
      receivedAt: new Date(),
      events: [],
    } as never);

    const wrongPhoneError = await getPublicTicketStatus("SVC-2607-0042", "9999").catch((e) => e);
    const missingTicketError = await getPublicTicketStatus("SVC-2607-9999", "9999").catch((e) => e);

    expect(wrongPhoneError).toBeInstanceOf(NotFoundError);
    expect(missingTicketError).toBeInstanceOf(NotFoundError);
    expect((wrongPhoneError as NotFoundError).message).toBe(
      (missingTicketError as NotFoundError).message,
    );
  });

  it("returns the customer-visible status for the correct ticket number + phone digits", async () => {
    vi.mocked(db.serviceTicket.findUnique).mockResolvedValue({
      ticketNumber: "SVC-2607-0042",
      phone: "+9779800000001",
      status: TicketStatus.DIAGNOSING,
      deviceType: ServiceDeviceType.LAPTOP,
      brand: "HP",
      model: "Victus 15",
      branch: { name: "New Road", addressLine: "Ganga Path" },
      estimatedReadyAt: null,
      receivedAt: new Date(),
      events: [{ toStatus: TicketStatus.RECEIVED, note: null, createdAt: new Date() }],
    } as never);

    const result = await getPublicTicketStatus("SVC-2607-0042", "0001");

    expect(result.status).toBe(TicketStatus.DIAGNOSING);
    expect(result.branchName).toBe("New Road");
    expect(result.events).toHaveLength(1);
  });
});
