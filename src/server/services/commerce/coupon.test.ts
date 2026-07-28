import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CartView } from "./cart";

vi.mock("@/server/db", () => ({
  db: {
    coupon: { findUnique: vi.fn() },
    couponRedemption: { count: vi.fn() },
    order: { count: vi.fn() },
    product: { findMany: vi.fn() },
    customer: { findUnique: vi.fn() },
  },
}));

const { db } = await import("@/server/db");
const { previewCoupon } = await import("./coupon");

function coupon(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "coupon_1",
    code: "SAVE10",
    type: "PERCENTAGE",
    value: 10,
    minOrderPaisa: null,
    maxDiscountPaisa: null,
    usageLimit: null,
    usageLimitPerCustomer: null,
    usedCount: 0,
    startsAt: null,
    endsAt: null,
    isActive: true,
    appliesTo: "ALL",
    targetIds: [],
    excludeDiscounted: false,
    firstOrderOnly: false,
    ...overrides,
  };
}

function cartView(overrides: Partial<CartView> = {}): CartView {
  return {
    cartId: "cart_1",
    items: [
      {
        variantId: "variant_1",
        productId: "product_1",
        productSlug: "test-laptop",
        productName: "Test Laptop",
        variantLabel: null,
        imageUrl: null,
        imageAlt: "Test Laptop",
        unitPricePaisa: 10000,
        quantity: 2,
        lineTotalPaisa: 20000,
        availableQuantity: 10,
        isOutOfStock: false,
      },
    ],
    subtotalPaisa: 20000,
    itemCount: 2,
    warnings: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(db.coupon.findUnique).mockReset();
  vi.mocked(db.couponRedemption.count).mockReset();
  vi.mocked(db.order.count).mockReset();
  vi.mocked(db.product.findMany)
    .mockReset()
    .mockResolvedValue([
      { id: "product_1", brandId: "brand_1", primaryCategoryId: "category_1" },
    ] as never);
});

describe("previewCoupon", () => {
  it("throws COUPON_INVALID for a code that doesn't exist", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(null as never);
    await expect(previewCoupon("NOPE", cartView())).rejects.toMatchObject({
      code: "COUPON_INVALID",
    });
  });

  it("normalises the code to uppercase before looking it up", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(coupon() as never);
    await previewCoupon("save10", cartView());
    expect(db.coupon.findUnique).toHaveBeenCalledWith({ where: { code: "SAVE10" } });
  });

  it("throws COUPON_EXPIRED for a coupon past its endsAt", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(
      coupon({ endsAt: new Date("2000-01-01") }) as never,
    );
    await expect(previewCoupon("SAVE10", cartView())).rejects.toMatchObject({
      code: "COUPON_EXPIRED",
    });
  });

  it("throws COUPON_LIMIT_REACHED once usedCount reaches usageLimit", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(
      coupon({ usageLimit: 5, usedCount: 5 }) as never,
    );
    await expect(previewCoupon("SAVE10", cartView())).rejects.toMatchObject({
      code: "COUPON_LIMIT_REACHED",
    });
  });

  it("throws COUPON_INVALID when the cart subtotal is below minOrderPaisa", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(coupon({ minOrderPaisa: 50000 }) as never);
    await expect(previewCoupon("SAVE10", cartView())).rejects.toMatchObject({
      code: "COUPON_INVALID",
    });
  });

  it("computes a straightforward PERCENTAGE discount against the whole cart for appliesTo ALL", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(coupon({ value: 10 }) as never);
    const result = await previewCoupon("SAVE10", cartView());
    expect(result).toEqual({
      code: "SAVE10",
      type: "PERCENTAGE",
      discountPaisa: 2000,
      freeShipping: false,
    });
  });

  it("caps a PERCENTAGE discount at maxDiscountPaisa", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(
      coupon({ value: 50, maxDiscountPaisa: 5000 }) as never,
    );
    const result = await previewCoupon("SAVE10", cartView());
    expect(result.discountPaisa).toBe(5000);
  });

  it("never discounts more than the eligible subtotal for FIXED_AMOUNT", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(
      coupon({ type: "FIXED_AMOUNT", value: 999999 }) as never,
    );
    const result = await previewCoupon("SAVE10", cartView());
    expect(result.discountPaisa).toBe(20000);
  });

  it("returns freeShipping with zero discount for FREE_SHIPPING, skipping line eligibility entirely", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(coupon({ type: "FREE_SHIPPING" }) as never);
    const result = await previewCoupon("SAVE10", cartView());
    expect(result).toEqual({
      code: "SAVE10",
      type: "FREE_SHIPPING",
      discountPaisa: 0,
      freeShipping: true,
    });
    expect(db.product.findMany).not.toHaveBeenCalled();
  });

  it("throws COUPON_INVALID when appliesTo PRODUCT targets none of the cart's products", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(
      coupon({ appliesTo: "PRODUCT", targetIds: ["product_other"] }) as never,
    );
    await expect(previewCoupon("SAVE10", cartView())).rejects.toMatchObject({
      code: "COUPON_INVALID",
    });
  });

  it("discounts only the eligible line when appliesTo BRAND matches", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(
      coupon({ appliesTo: "BRAND", targetIds: ["brand_1"], value: 10 }) as never,
    );
    const result = await previewCoupon("SAVE10", cartView());
    expect(result.discountPaisa).toBe(2000);
  });

  it("throws CART_EMPTY for a cart with no items", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(coupon() as never);
    await expect(previewCoupon("SAVE10", cartView({ items: [] }))).rejects.toMatchObject({
      code: "CART_EMPTY",
    });
  });

  it("throws COUPON_INVALID when usageLimitPerCustomer requires a signed-in customer that isn't present", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(
      coupon({ usageLimitPerCustomer: 1 }) as never,
    );
    await expect(previewCoupon("SAVE10", cartView())).rejects.toMatchObject({
      code: "COUPON_INVALID",
    });
  });

  it("throws COUPON_LIMIT_REACHED once a customer's own redemption count hits usageLimitPerCustomer", async () => {
    vi.mocked(db.coupon.findUnique).mockResolvedValue(
      coupon({ usageLimitPerCustomer: 1 }) as never,
    );
    vi.mocked(db.couponRedemption.count).mockResolvedValue(1);
    await expect(previewCoupon("SAVE10", cartView(), "customer_1")).rejects.toMatchObject({
      code: "COUPON_LIMIT_REACHED",
    });
  });
});
