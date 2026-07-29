import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { EnquiryStatus } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    enquiry: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { listEnquiriesForAdmin, setEnquiryStatus } = await import("./enquiries");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

beforeEach(() => {
  vi.mocked(db.enquiry.findMany).mockReset();
  vi.mocked(db.enquiry.count).mockReset();
  vi.mocked(db.enquiry.findUnique).mockReset();
  vi.mocked(db.enquiry.update).mockReset();
  vi.mocked(recordAuditLog).mockClear();
});

describe("listEnquiriesForAdmin", () => {
  it("defaults to only UNREAD messages", async () => {
    vi.mocked(db.enquiry.findMany).mockResolvedValue([]);
    vi.mocked(db.enquiry.count).mockResolvedValue(0);

    await listEnquiriesForAdmin({ filter: "unread", page: 1 });

    const where = vi.mocked(db.enquiry.findMany).mock.calls[0]?.[0]?.where;
    expect(where).toEqual({ AND: [{ status: EnquiryStatus.UNREAD }] });
  });
});

describe("setEnquiryStatus", () => {
  it("throws NotFoundError for a missing enquiry", async () => {
    vi.mocked(db.enquiry.findUnique).mockResolvedValue(null as never);

    await expect(setEnquiryStatus("missing", EnquiryStatus.READ, ACTOR)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("records an audit log entry with the before/after status", async () => {
    vi.mocked(db.enquiry.findUnique).mockResolvedValue({ status: EnquiryStatus.UNREAD } as never);
    vi.mocked(db.enquiry.update).mockResolvedValue({} as never);

    await setEnquiryStatus("e1", EnquiryStatus.REPLIED, ACTOR);

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "enquiry.status_changed",
        before: { status: EnquiryStatus.UNREAD },
        after: { status: EnquiryStatus.REPLIED },
      }),
    );
  });
});
