import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, AppError } from "@/lib/errors";
import { CouponType, CouponAppliesTo } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    coupon: {
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
const { createCoupon, updateCoupon, setCouponActive } = await import("./coupons");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

const BASE_INPUT = {
  code: "SAVE10",
  type: CouponType.PERCENTAGE,
  value: 10,
  targetIds: [] as string[],
  appliesTo: CouponAppliesTo.ALL,
  excludeDiscounted: false,
  firstOrderOnly: false,
  isActive: true,
};

beforeEach(() => {
  vi.mocked(db.coupon.findMany).mockReset();
  vi.mocked(db.coupon.count).mockReset();
  vi.mocked(db.coupon.findUnique).mockReset();
  vi.mocked(db.coupon.create).mockReset();
  vi.mocked(db.coupon.update).mockReset();
  vi.mocked(recordAuditLog).mockClear();
});

describe("createCoupon", () => {
  it("rejects a duplicate code", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue({ id: "existing" } as never);

    await expect(createCoupon(BASE_INPUT, ACTOR)).rejects.toBeInstanceOf(AppError);
    expect(db.coupon.create).not.toHaveBeenCalled();
  });

  it("normalises the code to uppercase and converts FIXED_AMOUNT rupees to paisa", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.coupon.create).mockResolvedValue({
      id: "c1",
      code: "SAVE500",
      type: CouponType.FIXED_AMOUNT,
      value: 50000,
    } as never);

    await createCoupon(
      { ...BASE_INPUT, code: "save500", type: CouponType.FIXED_AMOUNT, value: 500 },
      ACTOR,
    );

    const data = vi.mocked(db.coupon.create).mock.calls[0]?.[0]?.data as {
      code: string;
      value: number;
    };
    expect(data.code).toBe("SAVE500");
    expect(data.value).toBe(50000);
    expect(recordAuditLog).toHaveBeenCalled();
  });

  it("stores zero value for FREE_SHIPPING regardless of the submitted value", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.coupon.create).mockResolvedValue({ id: "c1" } as never);

    await createCoupon({ ...BASE_INPUT, type: CouponType.FREE_SHIPPING, value: 999 }, ACTOR);

    const data = vi.mocked(db.coupon.create).mock.calls[0]?.[0]?.data as { value: number };
    expect(data.value).toBe(0);
  });
});

describe("updateCoupon", () => {
  it("throws NotFoundError for a missing coupon", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(null as never);

    await expect(updateCoupon("missing", BASE_INPUT, ACTOR)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("allows saving with the same code unchanged", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue({
      id: "c1",
      code: "SAVE10",
      value: 10,
      isActive: true,
    } as never);
    vi.mocked(db.coupon.update).mockResolvedValue({} as never);

    await updateCoupon("c1", BASE_INPUT, ACTOR);

    expect(db.coupon.update).toHaveBeenCalled();
  });

  it("rejects renaming to a code already used by another coupon", async () => {
    vi.mocked(db.coupon.findUnique)
      .mockResolvedValueOnce({ id: "c1", code: "OLD10", value: 10, isActive: true } as never)
      .mockResolvedValueOnce({ id: "c2" } as never);

    await expect(
      updateCoupon("c1", { ...BASE_INPUT, code: "SAVE10" }, ACTOR),
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe("setCouponActive", () => {
  it("throws NotFoundError for a missing coupon", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(null as never);

    await expect(setCouponActive("missing", false, ACTOR)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("records coupon.deactivated when turning a coupon off", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue({ isActive: true } as never);
    vi.mocked(db.coupon.update).mockResolvedValue({} as never);

    await setCouponActive("c1", false, ACTOR);

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "coupon.deactivated" }),
    );
  });
});
