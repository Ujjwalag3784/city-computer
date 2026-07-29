import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { ReviewStatus } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    review: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { listReviewsForAdmin, setReviewStatus, replyToReview } = await import("./reviews");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

beforeEach(() => {
  vi.mocked(db.review.findMany).mockReset();
  vi.mocked(db.review.count).mockReset();
  vi.mocked(db.review.findUnique).mockReset();
  vi.mocked(db.review.update).mockReset();
  vi.mocked(recordAuditLog).mockClear();
});

describe("listReviewsForAdmin", () => {
  it("defaults to only PENDING reviews for the needs-approval filter", async () => {
    vi.mocked(db.review.findMany).mockResolvedValue([]);
    vi.mocked(db.review.count).mockResolvedValue(0);

    await listReviewsForAdmin({ filter: "needs-approval", page: 1 });

    const where = vi.mocked(db.review.findMany).mock.calls[0]?.[0]?.where;
    expect(where).toEqual({ AND: [{ status: ReviewStatus.PENDING }] });
  });
});

describe("setReviewStatus", () => {
  it("throws NotFoundError for a missing review", async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(null as never);

    await expect(setReviewStatus("missing", ReviewStatus.APPROVED, ACTOR)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("records review.approved when approving", async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({ status: ReviewStatus.PENDING } as never);
    vi.mocked(db.review.update).mockResolvedValue({} as never);

    await setReviewStatus("r1", ReviewStatus.APPROVED, ACTOR);

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "review.approved" }),
    );
  });

  it("records review.rejected when rejecting", async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({ status: ReviewStatus.PENDING } as never);
    vi.mocked(db.review.update).mockResolvedValue({} as never);

    await setReviewStatus("r1", ReviewStatus.REJECTED, ACTOR);

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "review.rejected" }),
    );
  });
});

describe("replyToReview", () => {
  it("throws NotFoundError for a missing review", async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue(null as never);

    await expect(replyToReview("missing", "Thanks!", ACTOR)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("trims the reply before saving", async () => {
    vi.mocked(db.review.findUnique).mockResolvedValue({ adminReply: null } as never);
    vi.mocked(db.review.update).mockResolvedValue({} as never);

    await replyToReview("r1", "  Thanks for the feedback!  ", ACTOR);

    expect(db.review.update).toHaveBeenCalledWith({
      where: { id: "r1" },
      data: { adminReply: "Thanks for the feedback!" },
    });
  });
});
