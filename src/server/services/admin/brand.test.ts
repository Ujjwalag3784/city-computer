import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/errors";

vi.mock("@/server/db", () => ({
  db: {
    brand: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    product: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { createBrand, updateBrand, deleteBrand } = await import("./brand");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

function brandRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "brand_1",
    slug: "hp",
    name: "HP",
    description: null,
    website: null,
    logoId: null,
    isFeatured: false,
    isActive: true,
    metaTitle: null,
    metaDescription: null,
    translations: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(db.brand.findMany)
    .mockReset()
    .mockResolvedValue([] as never);
  vi.mocked(db.brand.findUnique).mockReset();
  vi.mocked(db.brand.create).mockReset();
  vi.mocked(db.brand.update).mockReset();
  vi.mocked(db.product.count)
    .mockReset()
    .mockResolvedValue(0 as never);
  vi.mocked(recordAuditLog).mockClear();
});

describe("createBrand", () => {
  it("slugifies the name when no explicit slug is given", async () => {
    vi.mocked(db.brand.create).mockResolvedValue(brandRow() as never);

    await createBrand({ name: "HP", isFeatured: false, isActive: true }, ACTOR);

    expect(db.brand.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "hp", name: "HP" }) }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "brand.created" }),
    );
  });

  it("de-duplicates against every existing brand slug", async () => {
    vi.mocked(db.brand.findMany).mockResolvedValue([{ slug: "hp" }] as never);
    vi.mocked(db.brand.create).mockResolvedValue(brandRow({ slug: "hp-2" }) as never);

    await createBrand({ name: "HP", isFeatured: false, isActive: true }, ACTOR);

    expect(db.brand.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "hp-2" }) }),
    );
  });
});

describe("updateBrand", () => {
  it("throws NotFoundError for an id that doesn't exist", async () => {
    vi.mocked(db.brand.findUnique).mockResolvedValue(null as never);

    await expect(
      updateBrand("brand_missing", { name: "HP", isFeatured: false, isActive: true }, ACTOR),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("writes an AuditLog entry on success", async () => {
    vi.mocked(db.brand.findUnique).mockResolvedValue(brandRow() as never);
    vi.mocked(db.brand.update).mockResolvedValue(brandRow({ name: "HP Inc." }) as never);

    await updateBrand("brand_1", { name: "HP Inc.", isFeatured: false, isActive: true }, ACTOR);

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "brand.updated" }),
    );
  });
});

describe("deleteBrand", () => {
  it("refuses when the brand still has products", async () => {
    vi.mocked(db.brand.findUnique).mockResolvedValue(brandRow() as never);
    vi.mocked(db.product.count).mockResolvedValue(5 as never);

    await expect(deleteBrand("brand_1", ACTOR)).rejects.toBeInstanceOf(ValidationError);
    expect(db.brand.update).not.toHaveBeenCalled();
  });

  it("soft-deletes when the brand has no products", async () => {
    vi.mocked(db.brand.findUnique).mockResolvedValue(brandRow() as never);
    vi.mocked(db.product.count).mockResolvedValue(0 as never);
    vi.mocked(db.brand.update).mockResolvedValue(brandRow() as never);

    await deleteBrand("brand_1", ACTOR);

    expect(db.brand.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "brand_1" },
        data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
      }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "brand.deleted" }),
    );
  });
});
