import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { Province } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    branch: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    branchHours: { upsert: vi.fn() },
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { getBranchForAdmin, createBranch, updateBranch } = await import("./branches");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

const BASE_INPUT = {
  name: "New Road",
  addressLine: "Ganga Path",
  district: "Kathmandu",
  province: Province.BAGMATI,
  phone: "+977-1-4123456",
  isPickupEnabled: true,
  isDefaultFulfilment: false,
  isActive: true,
  hours: Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    isClosed: dayOfWeek === 6,
    openTime: "10:00",
    closeTime: "19:00",
  })),
};

beforeEach(() => {
  vi.mocked(db.branch.findMany).mockReset();
  vi.mocked(db.branch.findUnique).mockReset();
  vi.mocked(db.branch.create).mockReset();
  vi.mocked(db.branch.update).mockReset();
  vi.mocked(db.branch.count).mockReset();
  vi.mocked(db.branchHours.upsert).mockReset();
  vi.mocked(recordAuditLog).mockClear();
});

describe("getBranchForAdmin", () => {
  it("throws NotFoundError for a missing branch", async () => {
    vi.mocked(db.branch.findUnique).mockResolvedValue(null as never);

    await expect(getBranchForAdmin("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe("createBranch", () => {
  it("creates the branch and writes all 7 BranchHours rows", async () => {
    vi.mocked(db.branch.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.branch.count).mockResolvedValue(1);
    vi.mocked(db.branch.create).mockResolvedValue({ id: "b1", name: "New Road" } as never);
    vi.mocked(db.branchHours.upsert).mockResolvedValue({} as never);

    const result = await createBranch(BASE_INPUT, ACTOR);

    expect(result).toEqual({ id: "b1" });
    expect(db.branchHours.upsert).toHaveBeenCalledTimes(7);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "branch.created" }),
    );
  });

  it("stores no open/close time for a closed day even if one was submitted", async () => {
    vi.mocked(db.branch.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.branch.count).mockResolvedValue(0);
    vi.mocked(db.branch.create).mockResolvedValue({ id: "b1" } as never);
    vi.mocked(db.branchHours.upsert).mockResolvedValue({} as never);

    await createBranch(BASE_INPUT, ACTOR);

    const saturdayCall = vi
      .mocked(db.branchHours.upsert)
      .mock.calls.find((call) => call[0]?.where?.branchId_dayOfWeek?.dayOfWeek === 6);
    expect(saturdayCall?.[0]?.create).toMatchObject({
      isClosed: true,
      openTime: null,
      closeTime: null,
    });
  });
});

describe("updateBranch", () => {
  it("throws NotFoundError for a missing branch", async () => {
    vi.mocked(db.branch.findUnique).mockResolvedValue(null as never);

    await expect(updateBranch("missing", BASE_INPUT, ACTOR)).rejects.toBeInstanceOf(NotFoundError);
  });
});
