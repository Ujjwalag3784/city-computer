import { beforeEach, describe, expect, it, vi } from "vitest";
import { Locale } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";

// category.ts is a pure Prisma read layer — mocked the same way
// server/services/auth/register.test.ts mocks `@/server/db`, so these
// tests exercise the tree-building and materialised-path descendant
// logic without a real database.
vi.mock("@/server/db", () => ({
  db: {
    category: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  },
}));

const { db } = await import("@/server/db");
const {
  getCategoryBreadcrumbTrail,
  getCategoryByPath,
  getCategoryDescendantIds,
  getCategoryDescendantIdsByPath,
  getCategoryTree,
} = await import("./category");

beforeEach(() => {
  vi.mocked(db.category.findMany).mockReset();
  vi.mocked(db.category.findFirst).mockReset();
  vi.mocked(db.category.findUnique).mockReset();
});

function translation(locale: Locale, name: string) {
  return { locale, name, description: null, metaTitle: null, metaDescription: null };
}

describe("getCategoryTree", () => {
  it("nests children under their parent by parentId", async () => {
    vi.mocked(db.category.findMany).mockResolvedValue([
      {
        id: "cat_laptops",
        slug: "laptops",
        path: "laptops",
        depth: 0,
        parentId: null,
        imageId: null,
        iconName: null,
        translations: [translation(Locale.EN, "Laptops")],
      },
      {
        id: "cat_gaming",
        slug: "gaming",
        path: "laptops/gaming",
        depth: 1,
        parentId: "cat_laptops",
        imageId: null,
        iconName: null,
        translations: [translation(Locale.EN, "Gaming Laptops")],
      },
    ] as never);

    const tree = await getCategoryTree(Locale.EN);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.name).toBe("Laptops");
    expect(tree[0]?.children).toHaveLength(1);
    expect(tree[0]?.children[0]?.name).toBe("Gaming Laptops");
  });

  it("surfaces a category as its own root when its parent isn't in the nav-eligible set", async () => {
    vi.mocked(db.category.findMany).mockResolvedValue([
      {
        id: "cat_orphan",
        slug: "orphan",
        path: "hidden/orphan",
        depth: 1,
        parentId: "cat_hidden_parent",
        imageId: null,
        iconName: null,
        translations: [translation(Locale.EN, "Orphan")],
      },
    ] as never);

    const tree = await getCategoryTree(Locale.EN);
    expect(tree).toHaveLength(1);
    expect(tree[0]?.slug).toBe("orphan");
  });

  it("resolves a Nepali name when present, English otherwise", async () => {
    vi.mocked(db.category.findMany).mockResolvedValue([
      {
        id: "cat_laptops",
        slug: "laptops",
        path: "laptops",
        depth: 0,
        parentId: null,
        imageId: null,
        iconName: null,
        translations: [translation(Locale.EN, "Laptops"), translation(Locale.NE, "ल्यापटप")],
      },
    ] as never);

    const tree = await getCategoryTree(Locale.NE);
    expect(tree[0]?.name).toBe("ल्यापटप");
  });
});

describe("getCategoryByPath", () => {
  it("throws NotFoundError when no active category matches the path", async () => {
    vi.mocked(db.category.findFirst).mockResolvedValue(null);
    await expect(getCategoryByPath("does/not/exist")).rejects.toThrow(NotFoundError);
  });

  it("returns the resolved detail shape for a match", async () => {
    vi.mocked(db.category.findFirst).mockResolvedValue({
      id: "cat_gaming",
      slug: "gaming",
      path: "laptops/gaming",
      depth: 1,
      imageId: null,
      iconName: null,
      metaTitle: null,
      metaDescription: null,
      specTemplateId: "template_laptop",
      translations: [translation(Locale.EN, "Gaming Laptops")],
    } as never);

    const detail = await getCategoryByPath("laptops/gaming");
    expect(detail.name).toBe("Gaming Laptops");
    expect(detail.specTemplateId).toBe("template_laptop");
  });
});

describe("getCategoryDescendantIds", () => {
  it("throws NotFoundError for an unknown category id", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue(null);
    await expect(getCategoryDescendantIds("missing")).rejects.toThrow(NotFoundError);
  });

  it("queries for the category's own id plus every path-prefixed descendant", async () => {
    vi.mocked(db.category.findUnique).mockResolvedValue({
      id: "cat_laptops",
      path: "laptops",
    } as never);
    vi.mocked(db.category.findMany).mockResolvedValue([
      { id: "cat_laptops" },
      { id: "cat_gaming" },
      { id: "cat_business" },
    ] as never);

    const ids = await getCategoryDescendantIds("cat_laptops");

    expect(db.category.findMany).toHaveBeenCalledWith({
      where: { OR: [{ id: "cat_laptops" }, { path: { startsWith: "laptops/" } }] },
      select: { id: true },
    });
    expect(ids).toEqual(["cat_laptops", "cat_gaming", "cat_business"]);
  });
});

describe("getCategoryDescendantIdsByPath", () => {
  it("resolves the path to an id before delegating to getCategoryDescendantIds", async () => {
    vi.mocked(db.category.findFirst).mockResolvedValue({ id: "cat_laptops" } as never);
    vi.mocked(db.category.findUnique).mockResolvedValue({
      id: "cat_laptops",
      path: "laptops",
    } as never);
    vi.mocked(db.category.findMany).mockResolvedValue([{ id: "cat_laptops" }] as never);

    const ids = await getCategoryDescendantIdsByPath("laptops");
    expect(ids).toEqual(["cat_laptops"]);
  });

  it("throws NotFoundError when the path itself doesn't resolve", async () => {
    vi.mocked(db.category.findFirst).mockResolvedValue(null);
    await expect(getCategoryDescendantIdsByPath("nope")).rejects.toThrow(NotFoundError);
  });
});

describe("getCategoryBreadcrumbTrail", () => {
  it("returns one segment per ancestor, in order, from the pre-computed cumulative paths", async () => {
    vi.mocked(db.category.findMany).mockResolvedValue([
      {
        slug: "gaming",
        path: "laptops/gaming",
        translations: [translation(Locale.EN, "Gaming Laptops")],
      },
      { slug: "laptops", path: "laptops", translations: [translation(Locale.EN, "Laptops")] },
    ] as never);

    const trail = await getCategoryBreadcrumbTrail("laptops/gaming");

    expect(db.category.findMany).toHaveBeenCalledWith({
      where: { path: { in: ["laptops", "laptops/gaming"] }, isActive: true },
      include: { translations: true },
    });
    expect(trail).toEqual([
      { slug: "laptops", path: "laptops", name: "Laptops" },
      { slug: "gaming", path: "laptops/gaming", name: "Gaming Laptops" },
    ]);
  });

  it("skips a missing ancestor rather than throwing", async () => {
    vi.mocked(db.category.findMany).mockResolvedValue([
      {
        slug: "gaming",
        path: "laptops/gaming",
        translations: [translation(Locale.EN, "Gaming Laptops")],
      },
    ] as never);

    const trail = await getCategoryBreadcrumbTrail("laptops/gaming");
    expect(trail).toEqual([{ slug: "gaming", path: "laptops/gaming", name: "Gaming Laptops" }]);
  });
});
