import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MenuKey, PostStatus } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    menu: { findUnique: vi.fn(), findMany: vi.fn() },
    menuItem: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      aggregate: vi.fn(),
    },
    category: { findUnique: vi.fn(), findFirst: vi.fn() },
    brand: { findUnique: vi.fn() },
    page: { findUnique: vi.fn(), findFirst: vi.fn() },
    product: { findUnique: vi.fn() },
    post: { findFirst: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { moveMenuItem, checkMenuLinks } = await import("./menus");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.$transaction).mockImplementation(async (ops: unknown) =>
    Promise.all(ops as Promise<unknown>[]),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("moveMenuItem", () => {
  it("does nothing when there is no neighbour in that direction", async () => {
    vi.mocked(db.menuItem.findUnique).mockResolvedValue({
      id: "i1",
      menuId: "m1",
      parentId: null,
      position: 0,
    } as never);
    vi.mocked(db.menuItem.findFirst).mockResolvedValue(null as never);

    await moveMenuItem("i1", "up", ACTOR);

    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("swaps positions with the neighbouring item", async () => {
    vi.mocked(db.menuItem.findUnique).mockResolvedValue({
      id: "i1",
      menuId: "m1",
      parentId: null,
      position: 2,
    } as never);
    vi.mocked(db.menuItem.findFirst).mockResolvedValue({ id: "i0", position: 1 } as never);

    await moveMenuItem("i1", "up", ACTOR);

    expect(db.$transaction).toHaveBeenCalled();
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "menu_item.reordered" }),
    );
  });
});

describe("checkMenuLinks", () => {
  it("flags a category item whose category was deleted as broken", async () => {
    vi.mocked(db.menuItem.findMany).mockResolvedValue([
      {
        id: "i1",
        menu: { key: MenuKey.HEADER },
        label: "Laptops",
        categoryId: "cat1",
        brandId: null,
        pageId: null,
        url: null,
        category: null,
        brand: null,
        page: null,
      },
    ] as never);

    const results = await checkMenuLinks();
    expect(results).toEqual([expect.objectContaining({ label: "Laptops", status: "broken" })]);
  });

  it("flags a category item whose category is turned off (not deleted) as broken", async () => {
    vi.mocked(db.menuItem.findMany).mockResolvedValue([
      {
        id: "i1",
        menu: { key: MenuKey.HEADER },
        label: "Laptops",
        categoryId: "cat1",
        brandId: null,
        pageId: null,
        url: null,
        category: { id: "cat1", isActive: false },
        brand: null,
        page: null,
      },
    ] as never);

    const results = await checkMenuLinks();
    expect(results[0]?.status).toBe("broken");
  });

  it("marks a page item ok only when the page is published and not deleted", async () => {
    vi.mocked(db.menuItem.findMany).mockResolvedValue([
      {
        id: "i1",
        menu: { key: MenuKey.FOOTER_COMPANY },
        label: "Warranty",
        categoryId: null,
        brandId: null,
        pageId: "page1",
        url: null,
        category: null,
        brand: null,
        page: { id: "page1", status: PostStatus.PUBLISHED, deletedAt: null },
      },
    ] as never);

    const results = await checkMenuLinks();
    expect(results[0]?.status).toBe("ok");
  });

  it("resolves an internal /pages/ url against the real Page table", async () => {
    vi.mocked(db.menuItem.findMany).mockResolvedValue([
      {
        id: "i1",
        menu: { key: MenuKey.FOOTER_COMPANY },
        label: "Old link",
        categoryId: null,
        brandId: null,
        pageId: null,
        url: "/pages/does-not-exist",
        category: null,
        brand: null,
        page: null,
      },
    ] as never);
    vi.mocked(db.page.findFirst).mockResolvedValue(null as never);

    const results = await checkMenuLinks();
    expect(results[0]?.status).toBe("broken");
  });

  it("reports 'unknown' rather than 'broken' when an external URL can't be reached", async () => {
    vi.mocked(db.menuItem.findMany).mockResolvedValue([
      {
        id: "i1",
        menu: { key: MenuKey.HEADER },
        label: "Partner site",
        categoryId: null,
        brandId: null,
        pageId: null,
        url: "https://example.com/partner",
        category: null,
        brand: null,
        page: null,
      },
    ] as never);
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network blocked")));

    const results = await checkMenuLinks();
    expect(results[0]?.status).toBe("unknown");
  });

  it("flags a menu item with nothing set at all as broken", async () => {
    vi.mocked(db.menuItem.findMany).mockResolvedValue([
      {
        id: "i1",
        menu: { key: MenuKey.MOBILE },
        label: "Empty",
        categoryId: null,
        brandId: null,
        pageId: null,
        url: null,
        category: null,
        brand: null,
        page: null,
      },
    ] as never);

    const results = await checkMenuLinks();
    expect(results[0]?.status).toBe("broken");
  });
});
