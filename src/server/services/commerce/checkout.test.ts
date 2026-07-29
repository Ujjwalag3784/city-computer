import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/db", () => ({
  db: {
    deliveryZone: { findMany: vi.fn() },
    shippingRate: { findMany: vi.fn() },
    variant: { findMany: vi.fn() },
  },
}));

const { db } = await import("@/server/db");
const {
  computeVatPaisa,
  buildOrderTotals,
  getAvailablePaymentMethods,
  resolveDeliveryZoneForDistrict,
  computeShippingPaisa,
} = await import("./checkout");

function makeCartView(
  subtotalPaisa: number,
  items: { variantId: string; quantity: number }[] = [],
) {
  return {
    cartId: "cart_1",
    items: items.map((item) => ({
      variantId: item.variantId,
      productId: "product_1",
      productSlug: "product-1",
      productName: "Product",
      variantLabel: null,
      imageUrl: null,
      imageAlt: "",
      unitPricePaisa: 0,
      quantity: item.quantity,
      lineTotalPaisa: 0,
      availableQuantity: 100,
      isOutOfStock: false,
    })),
    subtotalPaisa,
    itemCount: items.reduce((sum, i) => sum + i.quantity, 0),
    warnings: [],
  } as never;
}

beforeEach(() => {
  vi.mocked(db.deliveryZone.findMany).mockReset();
  vi.mocked(db.shippingRate.findMany).mockReset();
  vi.mocked(db.variant.findMany).mockReset();
});

describe("computeVatPaisa", () => {
  it("extracts VAT out of an already-inclusive amount (rate/(100+rate)), not on top of it", () => {
    // 113 inclusive of 13% VAT -> the VAT component is exactly 13.
    expect(computeVatPaisa(11300)).toBe(1300);
  });

  it("returns 0 for a zero amount", () => {
    expect(computeVatPaisa(0)).toBe(0);
  });
});

describe("buildOrderTotals", () => {
  it("computes total as subtotal - discount + shipping, floored at 0", () => {
    const totals = buildOrderTotals(makeCartView(10000), 500, 200);
    expect(totals.subtotalPaisa).toBe(10000);
    expect(totals.discountPaisa).toBe(500);
    expect(totals.shippingPaisa).toBe(200);
    expect(totals.totalPaisa).toBe(9700);
  });

  it("never goes negative even if a discount exceeds the subtotal", () => {
    const totals = buildOrderTotals(makeCartView(1000), 5000, 0);
    expect(totals.totalPaisa).toBe(0);
  });

  it("computes the VAT note off the post-discount subtotal, not the pre-discount one", () => {
    const totals = buildOrderTotals(makeCartView(11300), 11300, 0);
    // Fully discounted away -> nothing left to extract VAT from.
    expect(totals.taxPaisa).toBe(0);
  });
});

describe("getAvailablePaymentMethods", () => {
  it("makes COD available under the configured cap and always offers bank transfer", () => {
    const methods = getAvailablePaymentMethods(100000); // NPR 1,000
    const cod = methods.find((m) => m.method === "COD");
    const bank = methods.find((m) => m.method === "BANK_TRANSFER");
    expect(cod?.available).toBe(true);
    expect(bank?.available).toBe(true);
  });

  it("disables COD above the configured cap, with a human-readable reason", () => {
    const methods = getAvailablePaymentMethods(300_000_00); // NPR 300,000 — well above the NPR 25,000 cap
    const cod = methods.find((m) => m.method === "COD");
    expect(cod?.available).toBe(false);
    expect(cod?.reason).toMatch(/cash on delivery/i);
  });
});

describe("resolveDeliveryZoneForDistrict", () => {
  it("matches a district case- and whitespace-insensitively", async () => {
    vi.mocked(db.deliveryZone.findMany).mockResolvedValue([
      { id: "zone_1", isActive: true, districts: ["Kathmandu", "Lalitpur"] },
    ] as never);

    const zone = await resolveDeliveryZoneForDistrict("  kathmandu  ");
    expect(zone).toMatchObject({ id: "zone_1" });
  });

  it("returns null when no active zone covers the district", async () => {
    vi.mocked(db.deliveryZone.findMany).mockResolvedValue([
      { id: "zone_1", isActive: true, districts: ["Kathmandu"] },
    ] as never);

    const zone = await resolveDeliveryZoneForDistrict("Jhapa");
    expect(zone).toBeNull();
  });
});

describe("computeShippingPaisa", () => {
  it("is always 0 for PICKUP regardless of zone", async () => {
    const cost = await computeShippingPaisa(
      { id: "zone_1" } as never,
      makeCartView(50000),
      "PICKUP",
    );
    expect(cost).toBe(0);
    expect(db.shippingRate.findMany).not.toHaveBeenCalled();
  });

  it("is 0 for DELIVERY when the district has no zone at all", async () => {
    const cost = await computeShippingPaisa(null, makeCartView(50000), "DELIVERY");
    expect(cost).toBe(0);
  });

  it("picks the cheapest of several active rates for the zone", async () => {
    vi.mocked(db.shippingRate.findMany).mockResolvedValue([
      { id: "rate_flat", type: "FLAT", basePaisa: 15000, freeAbovePaisa: null, perKgPaisa: null },
      { id: "rate_promo", type: "FREE_ABOVE", basePaisa: 20000, freeAbovePaisa: 30000 },
    ] as never);

    const cost = await computeShippingPaisa(
      { id: "zone_1" } as never,
      makeCartView(50000),
      "DELIVERY",
    );
    // Cart subtotal (50000) clears the FREE_ABOVE threshold (30000) -> that rate is 0, cheaper than the flat rate.
    expect(cost).toBe(0);
  });
});
