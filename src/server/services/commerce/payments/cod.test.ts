import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  db: {
    customer: { findUnique: vi.fn() },
    order: { count: vi.fn() },
    payment: { create: vi.fn(), findUnique: vi.fn() },
  },
}));

const { db } = await import("@/server/db");
const { checkCodEligibility, createCodPayment } = await import("./cod");

const BASE_ADDRESS = {
  streetAddress: "123 Main St",
  municipality: "Kathmandu Metro",
  district: "Kathmandu",
};

beforeEach(() => {
  vi.mocked(db.customer.findUnique)
    .mockReset()
    .mockResolvedValue({ codBlocked: false } as never);
  vi.mocked(db.order.count).mockReset().mockResolvedValue(0);
  vi.mocked(db.payment.create).mockReset();
});

describe("checkCodEligibility", () => {
  it("passes for an ordinary order well under every limit", async () => {
    await expect(
      checkCodEligibility({ totalPaisa: 100000, phone: "+9779800000000", address: BASE_ADDRESS }),
    ).resolves.toBeUndefined();
  });

  it("rejects an order above the configured value cap", async () => {
    await expect(
      checkCodEligibility({
        totalPaisa: 30_000_00,
        phone: "+9779800000000",
        address: BASE_ADDRESS,
      }),
    ).rejects.toMatchObject({ code: "COD_NOT_AVAILABLE" });
  });

  it("rejects a customer flagged codBlocked", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue({ codBlocked: true } as never);
    await expect(
      checkCodEligibility({
        totalPaisa: 1000,
        phone: "+9779800000000",
        customerId: "cust_1",
        address: BASE_ADDRESS,
      }),
    ).rejects.toMatchObject({ code: "COD_NOT_AVAILABLE" });
  });

  it("skips the codBlocked lookup entirely for a guest (no customerId)", async () => {
    await checkCodEligibility({ totalPaisa: 1000, phone: "+9779800000000", address: BASE_ADDRESS });
    expect(db.customer.findUnique).not.toHaveBeenCalled();
  });

  it("rejects once the phone already has the maximum number of open COD orders", async () => {
    vi.mocked(db.order.count).mockResolvedValueOnce(2); // openOrdersForPhone, at the default cap of 2
    await expect(
      checkCodEligibility({ totalPaisa: 1000, phone: "+9779800000000", address: BASE_ADDRESS }),
    ).rejects.toMatchObject({ code: "COD_NOT_AVAILABLE" });
  });

  it("rejects once the address already has the maximum number of COD orders this week", async () => {
    vi.mocked(db.order.count).mockResolvedValueOnce(0).mockResolvedValueOnce(3); // recentOrdersForAddress, at the default cap of 3
    await expect(
      checkCodEligibility({ totalPaisa: 1000, phone: "+9779800000000", address: BASE_ADDRESS }),
    ).rejects.toMatchObject({ code: "COD_NOT_AVAILABLE" });
  });
});

describe("createCodPayment", () => {
  it("creates a PENDING payment (money hasn't changed hands until the courier collects it)", async () => {
    vi.mocked(db.payment.create).mockResolvedValue({ id: "payment_1" } as never);

    await createCodPayment("order_1", 100000);

    expect(db.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          orderId: "order_1",
          provider: "COD",
          status: "PENDING",
          amountPaisa: 100000,
        }),
      }),
    );
  });
});
