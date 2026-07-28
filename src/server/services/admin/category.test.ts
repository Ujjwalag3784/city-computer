import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/errors";

// Same "mock the Prisma boundary, test the business logic" pattern as
// `server/services/auth/register.test.ts` — no real Postgres in this
// sandbox, and the point of these tests is the path/depth computation,
// the reorder-rejects-a-stale-set guard, and the delete-refuses-when-
// non-empty guard, not exercising a real database.
vi.mock("@/server/db", () => ({
  db: {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    product: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    productCategory: {
      groupBy: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { createCategory, updateCategory, reorderCategories, deleteCategory } = await import(
  "./category"
);

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

function categoryRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "cat_1",
    slug: "gaming-laptops",
    path: "gaming-laptops",
    depth: 0,
    position: 0,
    parentId: null,
    iconName: null,
    showInNav: true,
    showInFooter: false,
    isActive: true,
    metaTitle: null,
    metaDescription: null,
    translations: [{ locale: "EN", name: "Gaming Laptops", description: null }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(db.category.findMany)
    .mockReset()
    .mockResolvedValue([] as never);
  vi.mocked(db.category.findUnique).mockReset();
  vi.mocked(db.category.count)
    .mockReset()
    .mockResolvedValue(0 as never);
  vi.mocked(db.category.create).mockReset();
  vi.mocked(db.category.update).mockReset();
  vi.mocked(db.product.count)
    .mockReset()
    .mockResolvedValue(0 as never);
  vi.mocked(db.$transaction)
    .mockReset()
    .mockResolvedValue([] as never);
  vi.mocked(recordAuditLog).mockClear();
});

describe("createCategory", () => {
  it("computes path=slug and depth=0 for a top-level category", async () => {
    vi.mocked(db.category.count).mockResolvedValue(0 as never); // no siblings yet
    vi.mocked(db.category.create).mockResolvedValue(categoryRow() as never);

    await createCategory(
      {
        name: "Gaming Laptops",
        parentId: null,
        showInNav: true,
        showInFooter: false,
        isActive: true,
      },
      ACTOR,
    );

    expect(db.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          path: "gaming-laptops",
          depth: 0,
          parentId: null,
          position: 0,
        }),
      }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "category.created", entityType: "Category" }),
    );
  });

  it("nests path/depth under an existing parent", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue({ path: "laptops", depth: 0 } as never);
    vi.mocked(db.category.count).mockResolvedValue(2 as never); // two existing siblings
    vi.mocked(db.category.create).mockResolvedValue(
      categoryRow({
        path: "laptops/gaming-laptops",
        depth: 1,
        parentId: "cat_laptops",
        position: 2,
      }) as never,
    );

    await createCategory(
      {
        name: "Gaming Laptops",
        parentId: "cat_laptops",
        showInNav: true,
        showInFooter: false,
        isActive: true,
      },
      ACTOR,
    );

    expect(db.category.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          path: "laptops/gaming-laptops",
          depth: 1,
          parentId: "cat_laptops",
          position: 2,
        }),
      }),
    );
  });

  it("throws NotFoundError when parentId doesn't resolve to a real category", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue(null as never);

    await expect(
      createCategory(
        {
          name: "Orphan",
          parentId: "cat_missing",
          showInNav: true,
          showInFooter: false,
          isActive: true,
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
    expect(db.category.create).not.toHaveBeenCalled();
  });

  it("de-duplicates the slug against every existing category slug", async () => {
    vi.mocked(db.category.findMany).mockResolvedValue([{ slug: "gaming-laptops" }] as never);
    vi.mocked(db.category.create).mockResolvedValue(
      categoryRow({ slug: "gaming-laptops-2", path: "gaming-laptops-2" }) as never,
    );

    await createCategory(
      {
        name: "Gaming Laptops",
        parentId: null,
        showInNav: true,
        showInFooter: false,
        isActive: true,
      },
      ACTOR,
    );

    expect(db.category.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ slug: "gaming-laptops-2" }) }),
    );
  });
});

describe("updateCategory", () => {
  it("throws NotFoundError for an id that doesn't exist", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue(null as never);

    await expect(
      updateCategory(
        "cat_missing",
        {
          name: "New name",
          showInNav: true,
          showInFooter: false,
          isActive: true,
        },
        ACTOR,
      ),
    ).rejects.toBeInstanceOf(NotFoundError);
  });

  it("writes an AuditLog entry with before/after values", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue(categoryRow() as never);
    vi.mocked(db.category.update).mockResolvedValue(
      categoryRow({
        translations: [{ locale: "EN", name: "Renamed", description: null }],
      }) as never,
    );

    await updateCategory(
      "cat_1",
      { name: "Renamed", showInNav: true, showInFooter: false, isActive: true },
      ACTOR,
    );

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "category.updated",
        before: expect.objectContaining({ name: "Gaming Laptops" }),
        after: expect.objectContaining({ name: "Renamed" }),
      }),
    );
  });
});

describe("reorderCategories", () => {
  it("assigns position by array index and writes one audit entry for the whole gesture", async () => {
    vi.mocked(db.category.findMany).mockResolvedValue([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ] as never);

    await reorderCategories({ parentId: null, orderedIds: ["c", "a", "b"] }, ACTOR);

    expect(db.$transaction).toHaveBeenCalledTimes(1);
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "category.reordered" }),
    );
  });

  it("rejects a set that doesn't exactly match the current siblings, without touching the database", async () => {
    vi.mocked(db.category.findMany).mockResolvedValue([{ id: "a" }, { id: "b" }] as never);

    await expect(
      reorderCategories({ parentId: null, orderedIds: ["a", "b", "z"] }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("rejects a set missing a sibling that still exists", async () => {
    vi.mocked(db.category.findMany).mockResolvedValue([{ id: "a" }, { id: "b" }] as never);

    await expect(
      reorderCategories({ parentId: null, orderedIds: ["a"] }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("deleteCategory", () => {
  it("refuses when the category has children", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue(
      categoryRow({ _count: { children: 1 } }) as never,
    );

    await expect(deleteCategory("cat_1", ACTOR)).rejects.toBeInstanceOf(ValidationError);
    expect(db.category.update).not.toHaveBeenCalled();
  });

  it("refuses when the category still has products", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue(
      categoryRow({ _count: { children: 0 } }) as never,
    );
    vi.mocked(db.product.count).mockResolvedValue(3 as never);

    await expect(deleteCategory("cat_1", ACTOR)).rejects.toBeInstanceOf(ValidationError);
    expect(db.category.update).not.toHaveBeenCalled();
  });

  it("soft-deletes (isActive: false, deletedAt set) when empty", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue(
      categoryRow({ _count: { children: 0 } }) as never,
    );
    vi.mocked(db.product.count).mockResolvedValue(0 as never);
    vi.mocked(db.category.update).mockResolvedValue(categoryRow() as never);

    await deleteCategory("cat_1", ACTOR);

    expect(db.category.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "cat_1" },
        data: expect.objectContaining({ isActive: false, deletedAt: expect.any(Date) }),
      }),
    );
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "category.deleted" }),
    );
  });
});
