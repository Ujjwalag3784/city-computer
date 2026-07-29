import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";
import { PromotionType } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    promotion: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { createCampaign, updateCampaign, setCampaignActive } = await import("./campaigns");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };
const BASE_INPUT = {
  name: "Dashain sale",
  type: PromotionType.PERCENTAGE,
  priority: 0,
  stackable: false,
  isActive: true,
};

beforeEach(() => {
  vi.mocked(db.promotion.findMany).mockReset();
  vi.mocked(db.promotion.count).mockReset();
  vi.mocked(db.promotion.findUnique).mockReset();
  vi.mocked(db.promotion.create).mockReset();
  vi.mocked(db.promotion.update).mockReset();
  vi.mocked(recordAuditLog).mockClear();
});

describe("createCampaign", () => {
  it("creates a promotion and records an audit log entry", async () => {
    vi.mocked(db.promotion.create).mockResolvedValue({
      id: "p1",
      name: "Dashain sale",
      type: PromotionType.PERCENTAGE,
    } as never);

    const result = await createCampaign(BASE_INPUT, ACTOR);

    expect(result.id).toBe("p1");
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "campaign.created" }),
    );
  });
});

describe("updateCampaign", () => {
  it("throws NotFoundError for a missing campaign", async () => {
    vi.mocked(db.promotion.findUnique).mockResolvedValue(null as never);

    await expect(updateCampaign("missing", BASE_INPUT, ACTOR)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("setCampaignActive", () => {
  it("records campaign.activated when turning a campaign on", async () => {
    vi.mocked(db.promotion.findUnique).mockResolvedValue({ isActive: false } as never);
    vi.mocked(db.promotion.update).mockResolvedValue({} as never);

    await setCampaignActive("p1", true, ACTOR);

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "campaign.activated" }),
    );
  });

  it("throws NotFoundError for a missing campaign", async () => {
    vi.mocked(db.promotion.findUnique).mockResolvedValue(null as never);

    await expect(setCampaignActive("missing", true, ACTOR)).rejects.toBeInstanceOf(NotFoundError);
  });
});
