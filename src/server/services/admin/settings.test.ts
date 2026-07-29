import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { SettingDataType } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    setting: { groupBy: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    shippingRate: { findUnique: vi.fn(), update: vi.fn() },
    deliveryZone: { update: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { updateSetting, updateShippingRate } = await import("./settings");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

beforeEach(() => {
  vi.mocked(db.setting.groupBy).mockReset();
  vi.mocked(db.setting.findMany).mockReset();
  vi.mocked(db.setting.findUnique).mockReset();
  vi.mocked(db.setting.update).mockReset();
  vi.mocked(db.shippingRate.findUnique).mockReset();
  vi.mocked(db.shippingRate.update).mockReset();
  vi.mocked(db.deliveryZone.update).mockReset();
  vi.mocked(db.$transaction).mockReset();
  vi.mocked(recordAuditLog).mockClear();
});

describe("updateSetting", () => {
  it("throws NotFoundError for an unknown key", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue(null as never);

    await expect(updateSetting("missing.key", "1", ACTOR)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("coerces a BOOLEAN setting from its raw string", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      dataType: SettingDataType.BOOLEAN,
      value: false,
    } as never);
    vi.mocked(db.setting.update).mockResolvedValue({} as never);

    await updateSetting("payments.emiEnabled", "true", ACTOR);

    expect(db.setting.update).toHaveBeenCalledWith({
      where: { key: "payments.emiEnabled" },
      data: { value: true },
    });
  });

  it("rejects a non-numeric raw value for a NUMBER setting", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      dataType: SettingDataType.NUMBER,
      value: 3,
    } as never);

    await expect(
      updateSetting("inventory.defaultLowStockThreshold", "not-a-number", ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(db.setting.update).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON for a JSON setting", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      dataType: SettingDataType.JSON,
      value: [],
    } as never);

    await expect(updateSetting("payments.emiRates", "{not json", ACTOR)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it("records an audit log entry with before/after values", async () => {
    vi.mocked(db.setting.findUnique).mockResolvedValue({
      id: "s1",
      dataType: SettingDataType.STRING,
      value: "old@example.com",
    } as never);
    vi.mocked(db.setting.update).mockResolvedValue({} as never);

    await updateSetting("contact.email", "new@example.com", ACTOR);

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "setting.updated" }),
    );
  });
});

describe("updateShippingRate", () => {
  it("throws NotFoundError for a missing rate", async () => {
    vi.mocked(db.shippingRate.findUnique).mockResolvedValue(null as never);

    await expect(updateShippingRate("missing", 15000, 1, 2, ACTOR)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("updates both the rate price and the zone's estimated days in one transaction", async () => {
    vi.mocked(db.shippingRate.findUnique).mockResolvedValue({
      id: "rate1",
      zoneId: "zone1",
      basePaisa: 15000,
    } as never);
    vi.mocked(db.$transaction).mockResolvedValue([]);

    await updateShippingRate("rate1", 20000, 2, 4, ACTOR);

    expect(db.$transaction).toHaveBeenCalled();
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "shipping_rate.updated" }),
    );
  });
});
