import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  db: {
    setting: { findFirst: vi.fn() },
    enquiry: { create: vi.fn() },
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const { db } = await import("@/server/db");
const { getPublicEmiData, submitEmiLead } = await import("./emi");

const VALID_SCHEDULE = [
  {
    bank: "Himalayan Bank",
    tenures: [{ months: 12, interestRatePercent: 6.99, processingFeePercent: 1.5 }],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPublicEmiData", () => {
  it("returns disabled with no schedules when payments.emiEnabled is false or missing", async () => {
    vi.mocked(db.setting.findFirst).mockResolvedValueOnce({ value: false } as never);
    vi.mocked(db.setting.findFirst).mockResolvedValueOnce({ value: VALID_SCHEDULE } as never);

    const result = await getPublicEmiData();

    expect(result).toEqual({ enabled: false, schedules: [] });
  });

  it("returns disabled with no schedules when the emiRates row is missing entirely", async () => {
    vi.mocked(db.setting.findFirst).mockResolvedValueOnce({ value: true } as never);
    vi.mocked(db.setting.findFirst).mockResolvedValueOnce(null as never);

    const result = await getPublicEmiData();

    expect(result).toEqual({ enabled: false, schedules: [] });
  });

  it("returns the parsed schedule when enabled and valid", async () => {
    vi.mocked(db.setting.findFirst).mockResolvedValueOnce({ value: true } as never);
    vi.mocked(db.setting.findFirst).mockResolvedValueOnce({ value: VALID_SCHEDULE } as never);

    const result = await getPublicEmiData();

    expect(result.enabled).toBe(true);
    expect(result.schedules).toEqual(VALID_SCHEDULE);
  });

  it("degrades to disabled/empty rather than throwing when the stored JSON fails schema validation", async () => {
    vi.mocked(db.setting.findFirst).mockResolvedValueOnce({ value: true } as never);
    vi.mocked(db.setting.findFirst).mockResolvedValueOnce({
      value: [{ bank: "Broken", tenures: "not-an-array" }],
    } as never);

    const result = await getPublicEmiData();

    expect(result).toEqual({ enabled: false, schedules: [] });
  });

  it("scopes both reads to isPublic: true so a non-public setting can never leak here", async () => {
    vi.mocked(db.setting.findFirst).mockResolvedValue(null as never);

    await getPublicEmiData();

    expect(db.setting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "payments.emiEnabled", isPublic: true } }),
    );
    expect(db.setting.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "payments.emiRates", isPublic: true } }),
    );
  });
});

describe("submitEmiLead", () => {
  it("creates a GENERAL enquiry with bank/tenure/amount folded into subject and message", async () => {
    vi.mocked(db.enquiry.create).mockResolvedValue({ id: "enq1" } as never);

    const result = await submitEmiLead({
      name: "Sita",
      phone: "9800000001",
      email: "",
      bank: "Himalayan Bank",
      tenureMonths: 12,
      amountPaisa: 100_000_00,
      companyWebsite: "",
    });

    expect(result).toEqual({ id: "enq1" });
    expect(db.enquiry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Sita",
          phone: "9800000001",
          email: null,
          type: "GENERAL",
          subject: expect.stringContaining("Himalayan Bank"),
          message: expect.stringContaining("12 months"),
        }),
      }),
    );
  });
});
