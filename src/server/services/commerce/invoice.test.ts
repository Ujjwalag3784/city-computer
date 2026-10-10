import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { renderInvoicePdf } from "./invoice";
import type { OrderDetail } from "./order-lookup";

function order(overrides: Partial<OrderDetail> = {}): OrderDetail {
  return {
    id: "o1",
    orderNumber: "CC-2026-000123",
    rawStatus: "CONFIRMED",
    visibleStatus: "CONFIRMED",
    extraStatusNote: null,
    placedAt: new Date("2026-10-10T08:00:00Z"),
    fulfilmentType: "DELIVERY",
    branch: null,
    items: [
      {
        id: "i1",
        productName:
          "Lenovo IdeaPad Slim 3 (Ryzen 7 5825U, 16GB, 1TB) with a very long name that must be cut",
        variantLabel: null,
        imageUrl: null,
        quantity: 1,
        unitPricePaisa: 7_990_000,
        lineTotalPaisa: 7_990_000,
      },
    ],
    addresses: [
      {
        type: "SHIPPING",
        fullName: "राम बहादुर श्रेष्ठ",
        phone: "9800000000",
        alternatePhone: null,
        province: "Bagmati",
        district: "काठमाडौं",
        municipality: "Kathmandu Metropolitan City",
        ward: 22,
        streetAddress: "न्यू रोड, “Shop 4” 😀",
        landmark: null,
      },
    ],
    totals: {
      subtotalPaisa: 7_990_000,
      discountPaisa: 0,
      shippingPaisa: 15_000,
      taxPaisa: 919_204,
      totalPaisa: 8_005_000,
      paidPaisa: 0,
    },
    payment: {
      id: "p1",
      provider: "BANK_TRANSFER",
      status: "PENDING",
      amountPaisa: 8_005_000,
      receiptMediaId: null,
      rejectionReason: null,
    },
    customerNote: null,
    ...overrides,
  } as OrderDetail;
}

describe("renderInvoicePdf", () => {
  it("renders Nepali names, addresses and amounts without throwing", async () => {
    const bytes = await renderInvoicePdf(order());
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe("%PDF-");
  });

  it("renders a plain English order", async () => {
    const plain = order();
    plain.addresses = plain.addresses.map((a) => ({
      ...a,
      fullName: "Ram Shrestha",
      district: "Kathmandu",
      streetAddress: "New Road",
    }));
    const bytes = await renderInvoicePdf(plain);
    expect(bytes.length).toBeGreaterThan(1000);
  });
});
