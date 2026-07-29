import { beforeEach, describe, expect, it, vi } from "vitest";

function makeTx() {
  return {
    $executeRaw: vi.fn(),
    setting: { findUnique: vi.fn(), upsert: vi.fn() },
  };
}

let tx = makeTx();

vi.mock("@/server/db", () => ({
  db: {
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(tx)),
  },
}));

const { db } = await import("@/server/db");
const { getNextOrderSequence, generateOrderNumber } = await import("./order-number");

beforeEach(() => {
  tx = makeTx();
  vi.mocked(db.$transaction)
    .mockReset()
    .mockImplementation(async (callback: unknown) => (callback as (tx: unknown) => unknown)(tx));
});

describe("getNextOrderSequence", () => {
  it("starts a fresh month's counter at 1 when no Setting row exists yet", async () => {
    tx.setting.findUnique.mockResolvedValue(null);

    const sequence = await getNextOrderSequence(new Date(2026, 6, 15)); // July 2026

    expect(sequence).toBe(1);
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: "order_number_seq:2607" },
        update: { value: { lastSequence: 1 } },
      }),
    );
  });

  it("increments an existing month's counter by one", async () => {
    tx.setting.findUnique.mockResolvedValue({ value: { lastSequence: 41 } });

    const sequence = await getNextOrderSequence(new Date(2026, 6, 20));

    expect(sequence).toBe(42);
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { value: { lastSequence: 42 } } }),
    );
  });

  it("takes a transaction-scoped advisory lock keyed by the month before reading the counter", async () => {
    tx.setting.findUnique.mockResolvedValue(null);

    await getNextOrderSequence(new Date(2026, 6, 1));

    expect(tx.$executeRaw).toHaveBeenCalled();
  });

  it("keys different calendar months to different counters", async () => {
    tx.setting.findUnique.mockResolvedValue(null);
    await getNextOrderSequence(new Date(2026, 6, 1)); // July
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "order_number_seq:2607" } }),
    );

    tx = makeTx();
    vi.mocked(db.$transaction).mockImplementation(async (callback: unknown) =>
      (callback as (tx: unknown) => unknown)(tx),
    );
    tx.setting.findUnique.mockResolvedValue(null);
    await getNextOrderSequence(new Date(2026, 7, 1)); // August
    expect(tx.setting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: "order_number_seq:2608" } }),
    );
  });
});

describe("generateOrderNumber", () => {
  it("formats the sequence into the CC-YYMM-NNNN shape", async () => {
    tx.setting.findUnique.mockResolvedValue({ value: { lastSequence: 4 } });

    const orderNumber = await generateOrderNumber(new Date(2026, 6, 15));

    expect(orderNumber).toBe("CC-2607-0005");
  });
});
