import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError } from "@/lib/errors";

const cookieStore = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => (cookieStore.has(name) ? { value: cookieStore.get(name) } : undefined),
    set: (name: string, value: string) => {
      cookieStore.set(name, value);
    },
    delete: (name: string) => {
      cookieStore.delete(name);
    },
  })),
}));

vi.mock("@/lib/ids", () => ({
  generateCartToken: vi.fn(() => "TOKEN_NEW"),
}));

vi.mock("@/server/services/admin/stock", () => ({
  getDefaultBranchId: vi.fn(),
  getPrimaryStockLevelsByVariantId: vi.fn(),
}));

vi.mock("@/server/db", () => ({
  db: {
    customer: { findUnique: vi.fn(), create: vi.fn() },
    cart: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    cartItem: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    variant: { findMany: vi.fn() },
  },
}));

const { db } = await import("@/server/db");
const { getPrimaryStockLevelsByVariantId } = await import("@/server/services/admin/stock");
const {
  findOrCreateCustomerId,
  getViewerCart,
  ensureCartForMutation,
  addItemToCart,
  updateItemQuantity,
  removeItem,
  getCartView,
  readCartCookieToken,
  CART_COOKIE_NAME,
} = await import("./cart");

function variantRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "variant_1",
    pricePaisa: 10000,
    isActive: true,
    deletedAt: null,
    allowBackorder: false,
    title: "16GB / 512GB",
    productId: "product_1",
    product: {
      slug: "test-laptop",
      displayTitle: "Test Laptop",
      media: [
        {
          role: "THUMBNAIL",
          media: { url: "https://x/img.jpg", cdnUrl: null, altText: "Test Laptop" },
        },
      ],
    },
    ...overrides,
  };
}

beforeEach(() => {
  cookieStore.clear();
  vi.mocked(db.customer.findUnique).mockReset();
  vi.mocked(db.customer.create).mockReset();
  vi.mocked(db.cart.findFirst).mockReset();
  vi.mocked(db.cart.findUnique).mockReset();
  vi.mocked(db.cart.create).mockReset();
  vi.mocked(db.cart.update).mockReset();
  vi.mocked(db.cart.delete).mockReset();
  vi.mocked(db.cartItem.findMany).mockReset();
  vi.mocked(db.cartItem.findUnique).mockReset();
  vi.mocked(db.cartItem.upsert).mockReset();
  vi.mocked(db.cartItem.update).mockReset();
  vi.mocked(db.cartItem.create).mockReset();
  vi.mocked(db.cartItem.deleteMany).mockReset();
  vi.mocked(db.variant.findMany).mockReset();
  vi.mocked(getPrimaryStockLevelsByVariantId).mockReset().mockResolvedValue(new Map());
});

describe("findOrCreateCustomerId", () => {
  it("returns the existing Customer id when one already exists for this user", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue({ id: "customer_1" } as never);

    const id = await findOrCreateCustomerId({ userId: "user_1" });

    expect(id).toBe("customer_1");
    expect(db.customer.create).not.toHaveBeenCalled();
  });

  it("creates a Customer row on the fly when the invariant somehow didn't hold", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.customer.create).mockResolvedValue({ id: "customer_new" } as never);

    const id = await findOrCreateCustomerId({ userId: "user_1", userEmail: "a@b.com" });

    expect(id).toBe("customer_new");
    expect(db.customer.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { userId: "user_1", email: "a@b.com" } }),
    );
  });
});

describe("getViewerCart", () => {
  it("returns null for a guest with no cart cookie", async () => {
    expect(await getViewerCart({})).toBeNull();
  });

  it("returns null for a signed-in user with no Customer row yet", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue(null as never);
    expect(await getViewerCart({ userId: "user_1" })).toBeNull();
  });

  it("looks up a guest's cart by their cookie token", async () => {
    cookieStore.set(CART_COOKIE_NAME, "TOKEN_ABC");
    vi.mocked(db.cart.findUnique).mockResolvedValue({ id: "cart_1", token: "TOKEN_ABC" } as never);

    const cart = await getViewerCart({});

    expect(db.cart.findUnique).toHaveBeenCalledWith({ where: { token: "TOKEN_ABC" } });
    expect(cart?.id).toBe("cart_1");
  });
});

describe("ensureCartForMutation", () => {
  it("creates a brand-new guest cart and sets the cookie when nothing exists yet", async () => {
    vi.mocked(db.cart.create).mockResolvedValue({ id: "cart_new", token: "TOKEN_NEW" } as never);

    const cart = await ensureCartForMutation({});

    expect(db.cart.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ token: "TOKEN_NEW" }) }),
    );
    expect(cart.id).toBe("cart_new");
    expect(await readCartCookieToken()).toBe("TOKEN_NEW");
  });

  it("slides a guest cart's expiry forward on repeat mutation rather than replacing it", async () => {
    cookieStore.set(CART_COOKIE_NAME, "TOKEN_ABC");
    vi.mocked(db.cart.findUnique).mockResolvedValue({ id: "cart_1", token: "TOKEN_ABC" } as never);
    vi.mocked(db.cart.update).mockResolvedValue({ id: "cart_1", token: "TOKEN_ABC" } as never);

    const cart = await ensureCartForMutation({});

    expect(db.cart.create).not.toHaveBeenCalled();
    expect(db.cart.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "cart_1" } }),
    );
    expect(cart.id).toBe("cart_1");
  });

  it("creates a fresh customer cart when a signed-in shopper has neither a customer cart nor a guest cookie", async () => {
    vi.mocked(db.customer.findUnique).mockResolvedValue({ id: "customer_1" } as never);
    vi.mocked(db.cart.findFirst).mockResolvedValue(null as never);
    vi.mocked(db.cart.create).mockResolvedValue({
      id: "cart_customer",
      customerId: "customer_1",
    } as never);

    const cart = await ensureCartForMutation({ userId: "user_1" });

    expect(db.cart.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ customerId: "customer_1" }) }),
    );
    expect(cart.id).toBe("cart_customer");
  });

  it("merges a guest cart into an already-existing customer cart, then clears the guest cookie", async () => {
    cookieStore.set(CART_COOKIE_NAME, "TOKEN_GUEST");
    vi.mocked(db.customer.findUnique).mockResolvedValue({ id: "customer_1" } as never);
    vi.mocked(db.cart.findFirst).mockResolvedValue({ id: "cart_customer" } as never);
    vi.mocked(db.cart.findUnique).mockResolvedValue({
      id: "cart_guest",
      token: "TOKEN_GUEST",
    } as never);
    vi.mocked(db.cartItem.findMany).mockResolvedValue([
      { variantId: "variant_1", quantity: 2, unitPricePaisaSnapshot: 10000, buildId: null },
    ] as never);
    vi.mocked(db.cartItem.findUnique).mockResolvedValue(null as never);

    const cart = await ensureCartForMutation({ userId: "user_1" });

    expect(db.cartItem.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          cartId: "cart_customer",
          variantId: "variant_1",
          quantity: 2,
        }),
      }),
    );
    expect(db.cart.delete).toHaveBeenCalledWith({ where: { id: "cart_guest" } });
    expect(cart.id).toBe("cart_customer");
    expect(await readCartCookieToken()).toBeNull();
  });

  it("adopts a guest cart as the customer's own cart when the customer has no cart yet", async () => {
    cookieStore.set(CART_COOKIE_NAME, "TOKEN_GUEST");
    vi.mocked(db.customer.findUnique).mockResolvedValue({ id: "customer_1" } as never);
    vi.mocked(db.cart.findFirst).mockResolvedValue(null as never);
    vi.mocked(db.cart.findUnique).mockResolvedValue({
      id: "cart_guest",
      token: "TOKEN_GUEST",
    } as never);
    vi.mocked(db.cart.update).mockResolvedValue({
      id: "cart_guest",
      customerId: "customer_1",
    } as never);

    const cart = await ensureCartForMutation({ userId: "user_1" });

    expect(db.cart.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cart_guest" },
        data: expect.objectContaining({ customerId: "customer_1" }),
      }),
    );
    expect(cart.id).toBe("cart_guest");
    expect(await readCartCookieToken()).toBeNull();
  });
});

describe("addItemToCart", () => {
  it("throws NotFoundError for a variant that doesn't exist", async () => {
    vi.mocked(db.variant.findMany).mockResolvedValue([] as never);

    await expect(addItemToCart("cart_1", "variant_missing", 1)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it("throws INSUFFICIENT_STOCK when the requested quantity exceeds what's available", async () => {
    vi.mocked(db.variant.findMany).mockResolvedValue([variantRow()] as never);
    vi.mocked(db.cartItem.findUnique).mockResolvedValue(null as never);
    vi.mocked(getPrimaryStockLevelsByVariantId).mockResolvedValue(
      new Map([
        [
          "variant_1",
          {
            branchId: "b",
            branchName: "Main",
            quantity: 2,
            reservedQuantity: 0,
            availableQuantity: 2,
          },
        ],
      ]),
    );

    await expect(addItemToCart("cart_1", "variant_1", 5)).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });
    expect(db.cartItem.upsert).not.toHaveBeenCalled();
  });

  it("allows exceeding stock when the variant allows backorder", async () => {
    vi.mocked(db.variant.findMany).mockResolvedValue([
      variantRow({ allowBackorder: true }),
    ] as never);
    vi.mocked(db.cartItem.findUnique).mockResolvedValue(null as never);
    vi.mocked(getPrimaryStockLevelsByVariantId).mockResolvedValue(
      new Map([
        [
          "variant_1",
          {
            branchId: "b",
            branchName: "Main",
            quantity: 0,
            reservedQuantity: 0,
            availableQuantity: 0,
          },
        ],
      ]),
    );

    await addItemToCart("cart_1", "variant_1", 3);

    expect(db.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ quantity: 3, unitPricePaisaSnapshot: 10000 }),
      }),
    );
  });

  it("sums onto an existing line's quantity and refreshes its price snapshot", async () => {
    vi.mocked(db.variant.findMany).mockResolvedValue([variantRow({ pricePaisa: 12000 })] as never);
    vi.mocked(db.cartItem.findUnique).mockResolvedValue({ quantity: 2 } as never);
    vi.mocked(getPrimaryStockLevelsByVariantId).mockResolvedValue(
      new Map([
        [
          "variant_1",
          {
            branchId: "b",
            branchName: "Main",
            quantity: 10,
            reservedQuantity: 0,
            availableQuantity: 10,
          },
        ],
      ]),
    );

    await addItemToCart("cart_1", "variant_1", 1);

    expect(db.cartItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { quantity: 3, unitPricePaisaSnapshot: 12000 },
      }),
    );
  });
});

describe("updateItemQuantity", () => {
  it("removes the line when quantity is set to 0", async () => {
    await updateItemQuantity("cart_1", "variant_1", 0);
    expect(db.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart_1", variantId: "variant_1" },
    });
  });

  it("throws INSUFFICIENT_STOCK rather than allowing an over-available quantity", async () => {
    vi.mocked(db.variant.findMany).mockResolvedValue([variantRow()] as never);
    vi.mocked(getPrimaryStockLevelsByVariantId).mockResolvedValue(
      new Map([
        [
          "variant_1",
          {
            branchId: "b",
            branchName: "Main",
            quantity: 1,
            reservedQuantity: 0,
            availableQuantity: 1,
          },
        ],
      ]),
    );

    await expect(updateItemQuantity("cart_1", "variant_1", 4)).rejects.toMatchObject({
      code: "INSUFFICIENT_STOCK",
    });
  });
});

describe("getCartView", () => {
  it("returns an empty view for a cart with no items", async () => {
    vi.mocked(db.cartItem.findMany).mockResolvedValue([] as never);

    const view = await getCartView("cart_1");

    expect(view).toEqual({
      cartId: "cart_1",
      items: [],
      subtotalPaisa: 0,
      itemCount: 0,
      warnings: [],
    });
  });

  it("computes the subtotal from current price, not the stored snapshot", async () => {
    vi.mocked(db.cartItem.findMany).mockResolvedValue([
      { variantId: "variant_1", quantity: 2, unitPricePaisaSnapshot: 10000, addedAt: new Date() },
    ] as never);
    vi.mocked(db.variant.findMany).mockResolvedValue([variantRow({ pricePaisa: 12000 })] as never);
    vi.mocked(getPrimaryStockLevelsByVariantId).mockResolvedValue(
      new Map([
        [
          "variant_1",
          {
            branchId: "b",
            branchName: "Main",
            quantity: 10,
            reservedQuantity: 0,
            availableQuantity: 10,
          },
        ],
      ]),
    );

    const view = await getCartView("cart_1");

    expect(view.subtotalPaisa).toBe(24000);
    expect(view.itemCount).toBe(2);
    expect(view.warnings).toEqual([
      expect.objectContaining({
        type: "PRICE_CHANGED",
        previousUnitPricePaisa: 10000,
        currentUnitPricePaisa: 12000,
      }),
    ]);
  });

  it("surfaces a STOCK_REDUCED warning without dropping the line", async () => {
    vi.mocked(db.cartItem.findMany).mockResolvedValue([
      { variantId: "variant_1", quantity: 5, unitPricePaisaSnapshot: 10000, addedAt: new Date() },
    ] as never);
    vi.mocked(db.variant.findMany).mockResolvedValue([variantRow()] as never);
    vi.mocked(getPrimaryStockLevelsByVariantId).mockResolvedValue(
      new Map([
        [
          "variant_1",
          {
            branchId: "b",
            branchName: "Main",
            quantity: 2,
            reservedQuantity: 0,
            availableQuantity: 2,
          },
        ],
      ]),
    );

    const view = await getCartView("cart_1");

    expect(view.items).toHaveLength(1);
    expect(view.warnings).toEqual([
      expect.objectContaining({ type: "STOCK_REDUCED", availableQuantity: 2 }),
    ]);
  });

  it("drops a line and warns NO_LONGER_AVAILABLE for a deactivated variant", async () => {
    vi.mocked(db.cartItem.findMany).mockResolvedValue([
      { variantId: "variant_1", quantity: 1, unitPricePaisaSnapshot: 10000, addedAt: new Date() },
    ] as never);
    vi.mocked(db.variant.findMany).mockResolvedValue([variantRow({ isActive: false })] as never);
    vi.mocked(getPrimaryStockLevelsByVariantId).mockResolvedValue(new Map());

    const view = await getCartView("cart_1");

    expect(view.items).toHaveLength(0);
    expect(view.warnings).toEqual([expect.objectContaining({ type: "NO_LONGER_AVAILABLE" })]);
    expect(db.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart_1", variantId: "variant_1" },
    });
  });
});

describe("removeItem", () => {
  it("deletes the cart item row", async () => {
    await removeItem("cart_1", "variant_1");
    expect(db.cartItem.deleteMany).toHaveBeenCalledWith({
      where: { cartId: "cart_1", variantId: "variant_1" },
    });
  });
});
