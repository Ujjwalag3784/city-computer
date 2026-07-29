import { beforeEach, describe, expect, it, vi } from "vitest";
import { TicketStatus } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: { job: { create: vi.fn() } },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { db } = await import("@/server/db");
const { logger } = await import("@/lib/logger");
const { buildTicketStatusMessage, queueTicketNotification } = await import(
  "./ticket-notifications"
);

beforeEach(() => {
  vi.mocked(db.job.create).mockReset();
  vi.mocked(logger.error).mockClear();
});

describe("buildTicketStatusMessage", () => {
  it("includes the customer's name and the ticket number for RECEIVED", () => {
    const message = buildTicketStatusMessage("SVC-2607-0001", TicketStatus.RECEIVED, "Ramesh");
    expect(message).toContain("Ramesh");
    expect(message).toContain("SVC-2607-0001");
  });

  it("produces a distinct message per status", () => {
    const received = buildTicketStatusMessage("SVC-2607-0001", TicketStatus.RECEIVED, "Ramesh");
    const ready = buildTicketStatusMessage(
      "SVC-2607-0001",
      TicketStatus.READY_FOR_PICKUP,
      "Ramesh",
    );
    expect(received).not.toBe(ready);
    expect(ready).toMatch(/ready for pickup/i);
  });

  it("covers every TicketStatus value without throwing", () => {
    for (const status of Object.values(TicketStatus)) {
      expect(() => buildTicketStatusMessage("SVC-2607-0001", status, "Ramesh")).not.toThrow();
    }
  });
});

describe("queueTicketNotification", () => {
  it("creates a Job row with the channel, recipient, and message", async () => {
    vi.mocked(db.job.create).mockResolvedValue({} as never);

    await queueTicketNotification("t1", "sms", "+9779800000000", "Hi Ramesh, ...");

    expect(db.job.create).toHaveBeenCalledWith({
      data: {
        type: "ticket_notification",
        payload: {
          ticketId: "t1",
          channel: "sms",
          recipient: "+9779800000000",
          message: "Hi Ramesh, ...",
        },
        runAt: expect.any(Date),
      },
    });
  });

  it("swallows a failure rather than throwing — never blocks the caller's mutation", async () => {
    vi.mocked(db.job.create).mockRejectedValue(new Error("db down"));

    await expect(
      queueTicketNotification("t1", "email", "a@b.com", "message"),
    ).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalled();
  });
});
