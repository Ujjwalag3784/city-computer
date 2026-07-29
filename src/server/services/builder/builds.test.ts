import { beforeEach, describe, expect, it, vi } from "vitest";
import { ForbiddenError, NotFoundError } from "@/lib/errors";

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
  generateBuildShortId: vi.fn(() => "SHORTID1"),
  generateBuildSessionToken: vi.fn(() => "OWNER_TOKEN_NEW"),
}));

vi.mock("@/server/services/commerce/cart", () => ({
  findOrCreateCustomerId: vi.fn(async () => "customer_1"),
  ensureCartForMutation: vi.fn(async () => ({ id: "cart_1" })),
  addItemToCart: vi.fn(async () => undefined),
}));

vi.mock("@/server/services/builder/validate-build", () => ({
  validateBuild: vi.fn(async () => ({
    buildId: "build_1",
    issues: [],
    connectorShortfalls: [],
    power: {
      baseLoadWatts: 400,
      peakLoadWatts: 500,
      recommendedPsuWatts: 650,
      selectedPsuWatts: null,
      loadPercent: null,
      verdict: "NO_PSU_SELECTED",
    },
    connectorBalance: {},
    balance: { cpuScore: 50, gpuScore: 50, rawBalance: 0, adjustedBalance: 0, verdict: "BALANCED" },
    totalPaisa: 250000,
    compatibilityScore: 100,
    errorCount: 0,
    warningCount: 0,
    infoCount: 0,
    isAddToCartBlocked: false,
    dataConfidenceNote: null,
  })),
}));

vi.mock("@/server/db", () => ({
  db: {
    build: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    componentPart: { findUnique: vi.fn() },
    variant: { findUnique: vi.fn() },
    buildItem: { upsert: vi.fn(), deleteMany: vi.fn() },
  },
}));

const { db } = await import("@/server/db");
const { addItemToCart, ensureCartForMutation } = await import("@/server/services/commerce/cart");
const { createBuild, setBuildItem, removeBuildItem, addBuildToCart, readBuildOwnerToken } =
  await import("./builds");

const GUEST_IDENTITY = { userId: undefined, userEmail: null };
const USER_IDENTITY = { userId: "user_1", userEmail: "user@example.com" };

beforeEach(() => {
  cookieStore.clear();
  vi.mocked(db.build.create).mockReset();
  vi.mocked(db.build.findUnique).mockReset();
  vi.mocked(db.build.update).mockReset();
  vi.mocked(db.componentPart.findUnique).mockReset();
  vi.mocked(db.variant.findUnique).mockReset();
  vi.mocked(db.buildItem.upsert).mockReset();
  vi.mocked(db.buildItem.deleteMany).mockReset();
  vi.mocked(addItemToCart).mockClear();
  vi.mocked(ensureCartForMutation).mockClear();
});

describe("createBuild", () => {
  it("mints a builder-owner cookie and stores the sessionToken for an anonymous build", async () => {
    vi.mocked(db.build.create).mockResolvedValue({ id: "build_1", shortId: "SHORTID1" } as never);

    const result = await createBuild(
      { mode: "STANDARD", useCase: "GAMING", targetResolution: "FHD", budgetPaisa: null },
      GUEST_IDENTITY,
    );

    expect(result.shortId).toBe("SHORTID1");
    expect(db.build.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerId: null, sessionToken: "OWNER_TOKEN_NEW" }),
      }),
    );
    expect(await readBuildOwnerToken()).toBe("OWNER_TOKEN_NEW");
  });

  it("attaches a signed-in shopper's customerId instead of a sessionToken", async () => {
    vi.mocked(db.build.create).mockResolvedValue({ id: "build_2", shortId: "SHORTID1" } as never);

    await createBuild(
      { mode: "GUIDED", useCase: "GAMING", targetResolution: "QHD", budgetPaisa: null },
      USER_IDENTITY,
    );

    expect(db.build.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ customerId: "customer_1", sessionToken: null }),
      }),
    );
  });

  it("retries shortId generation on a unique-constraint collision", async () => {
    const collision = Object.assign(new Error("unique violation"), { code: "P2002" });
    vi.mocked(db.build.create)
      .mockRejectedValueOnce(collision)
      .mockResolvedValueOnce({ id: "build_3", shortId: "SHORTID1" } as never);

    const result = await createBuild(
      { mode: "EXPERT", useCase: "GAMING", targetResolution: "FHD", budgetPaisa: null },
      GUEST_IDENTITY,
    );

    expect(result.id).toBe("build_3");
    expect(db.build.create).toHaveBeenCalledTimes(2);
  });
});

describe("ownership enforcement", () => {
  it("refuses to edit a build owned by a different anonymous session", async () => {
    cookieStore.set("city_build_owner", "SOMEONE_ELSES_TOKEN");
    vi.mocked(db.build.findUnique).mockResolvedValue({
      customerId: null,
      sessionToken: "THE_OWNERS_TOKEN",
    } as never);

    await expect(removeBuildItem("build_1", "cpu", GUEST_IDENTITY)).rejects.toBeInstanceOf(
      ForbiddenError,
    );
  });

  it("allows editing when the anonymous cookie matches the build's sessionToken", async () => {
    cookieStore.set("city_build_owner", "MY_TOKEN");
    vi.mocked(db.build.findUnique).mockResolvedValue({
      customerId: null,
      sessionToken: "MY_TOKEN",
    } as never);
    vi.mocked(db.buildItem.deleteMany).mockResolvedValue({ count: 1 } as never);

    await expect(removeBuildItem("build_1", "cpu", GUEST_IDENTITY)).resolves.toBeUndefined();
    expect(db.buildItem.deleteMany).toHaveBeenCalledWith({
      where: { buildId: "build_1", slotKey: "cpu" },
    });
  });

  it("throws NotFoundError for a build that doesn't exist", async () => {
    vi.mocked(db.build.findUnique).mockResolvedValue(null);
    await expect(removeBuildItem("missing", "cpu", GUEST_IDENTITY)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("setBuildItem", () => {
  it("snapshots the linked variant's current price", async () => {
    vi.mocked(db.build.findUnique).mockResolvedValue({
      customerId: "customer_1",
      sessionToken: null,
    } as never);
    vi.mocked(db.componentPart.findUnique).mockResolvedValue({
      id: "part_1",
      variantId: "variant_1",
      isActive: true,
    } as never);
    vi.mocked(db.variant.findUnique).mockResolvedValue({ pricePaisa: 45000 } as never);
    vi.mocked(db.buildItem.upsert).mockResolvedValue({} as never);

    await setBuildItem("build_1", "gpu", "part_1", 1, USER_IDENTITY);

    expect(db.buildItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ unitPricePaisaSnapshot: 45000 }),
        update: expect.objectContaining({ unitPricePaisaSnapshot: 45000 }),
      }),
    );
  });

  it("snapshots 0 for an informational-only part with no linked variant", async () => {
    vi.mocked(db.build.findUnique).mockResolvedValue({
      customerId: "customer_1",
      sessionToken: null,
    } as never);
    vi.mocked(db.componentPart.findUnique).mockResolvedValue({
      id: "part_2",
      variantId: null,
      isActive: true,
    } as never);
    vi.mocked(db.buildItem.upsert).mockResolvedValue({} as never);

    await setBuildItem("build_1", "gpu", "part_2", 1, USER_IDENTITY);

    expect(db.variant.findUnique).not.toHaveBeenCalled();
    expect(db.buildItem.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ unitPricePaisaSnapshot: 0 }) }),
    );
  });

  it("rejects an inactive part", async () => {
    vi.mocked(db.build.findUnique).mockResolvedValue({
      customerId: "customer_1",
      sessionToken: null,
    } as never);
    vi.mocked(db.componentPart.findUnique).mockResolvedValue({
      id: "part_3",
      variantId: null,
      isActive: false,
    } as never);

    await expect(setBuildItem("build_1", "gpu", "part_3", 1, USER_IDENTITY)).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });
});

describe("addBuildToCart", () => {
  it("adds every item with a linked variant and skips informational-only parts", async () => {
    vi.mocked(db.build.findUnique).mockResolvedValue({
      id: "build_1",
      items: [
        { quantity: 1, part: { variantId: "variant_1", model: "Some CPU" } },
        { quantity: 2, part: { variantId: null, model: "Generic Thermal Paste" } },
      ],
    } as never);

    const result = await addBuildToCart("build_1", GUEST_IDENTITY);

    expect(result.addedCount).toBe(1);
    expect(result.skippedPartNames).toEqual(["Generic Thermal Paste"]);
    expect(addItemToCart).toHaveBeenCalledWith("cart_1", "variant_1", 1, "build_1");
  });

  it("throws for a build with no items at all", async () => {
    vi.mocked(db.build.findUnique).mockResolvedValue({ id: "build_1", items: [] } as never);
    await expect(addBuildToCart("build_1", GUEST_IDENTITY)).rejects.toThrow();
  });
});
