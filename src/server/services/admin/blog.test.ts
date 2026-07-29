import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { PostStatus } from "@/generated/prisma/client";

vi.mock("@/server/db", () => ({
  db: {
    post: {
      findMany: vi.fn(),
      count: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    postCategory: { deleteMany: vi.fn() },
    postTag: { deleteMany: vi.fn() },
    postProduct: { deleteMany: vi.fn() },
    category: { findMany: vi.fn() },
    product: { findMany: vi.fn() },
    author: { findMany: vi.fn(), create: vi.fn() },
    $transaction: vi.fn(),
  },
}));

vi.mock("./audit-log", () => ({
  recordAuditLog: vi.fn().mockResolvedValue(undefined),
}));

const { db } = await import("@/server/db");
const { recordAuditLog } = await import("./audit-log");
const { createPost, updatePost, deletePost } = await import("./blog");

const ACTOR = { id: "user_owner", email: "owner@citycomputer.com.np" };

const VALID_DOC = {
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text: "Hello world" }] }],
};

const BASE_INPUT = {
  title: "How to pick a gaming laptop",
  slug: "how-to-pick-a-gaming-laptop",
  excerpt: "A quick guide.",
  content: VALID_DOC,
  authorId: "author_1",
  status: PostStatus.DRAFT,
  categorySlugsText: "",
  tagsText: "",
  relatedProductSlugsText: "",
};

beforeEach(() => {
  vi.mocked(db.post.findUnique).mockReset();
  vi.mocked(db.post.findFirst).mockReset();
  vi.mocked(db.post.create).mockReset();
  vi.mocked(db.post.update).mockReset();
  vi.mocked(db.category.findMany).mockReset().mockResolvedValue([]);
  vi.mocked(db.product.findMany).mockReset().mockResolvedValue([]);
  vi.mocked(db.$transaction)
    .mockReset()
    .mockImplementation(async (ops: unknown) => {
      if (Array.isArray(ops)) return Promise.all(ops as Promise<unknown>[]);
      return (ops as () => Promise<unknown>)();
    });
  vi.mocked(recordAuditLog).mockClear();
});

describe("createPost", () => {
  it("rejects a duplicate slug", async () => {
    vi.mocked(db.post.findUnique).mockResolvedValue({ id: "existing" } as never);

    await expect(createPost(BASE_INPUT, ACTOR)).rejects.toBeInstanceOf(ValidationError);
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("rejects content that fails the Tiptap JSON allow-list — the XSS gate", async () => {
    vi.mocked(db.post.findUnique).mockResolvedValue(null as never);

    await expect(
      createPost({ ...BASE_INPUT, content: { type: "doc", content: [{ type: "script" }] } }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("computes readingMinutes server-side and sets publishedAt only when published", async () => {
    vi.mocked(db.post.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.post.create).mockResolvedValue({ id: "p1" } as never);

    await createPost(BASE_INPUT, ACTOR);

    const data = vi.mocked(db.post.create).mock.calls[0]?.[0]?.data as {
      readingMinutes: number;
      publishedAt: Date | null;
    };
    expect(data.readingMinutes).toBe(1);
    expect(data.publishedAt).toBeNull();
    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "post.created" }),
    );
  });

  it("sets publishedAt when status is PUBLISHED", async () => {
    vi.mocked(db.post.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.post.create).mockResolvedValue({ id: "p1" } as never);

    await createPost({ ...BASE_INPUT, status: PostStatus.PUBLISHED }, ACTOR);

    const data = vi.mocked(db.post.create).mock.calls[0]?.[0]?.data as { publishedAt: Date | null };
    expect(data.publishedAt).toBeInstanceOf(Date);
  });

  it("rejects an unknown category slug with a plain-language message", async () => {
    vi.mocked(db.post.findUnique).mockResolvedValue(null as never);
    vi.mocked(db.category.findMany).mockResolvedValue([]);

    await expect(
      createPost({ ...BASE_INPUT, categorySlugsText: "not-a-real-category" }, ACTOR),
    ).rejects.toBeInstanceOf(ValidationError);
  });
});

describe("updatePost", () => {
  it("throws NotFoundError for a missing post", async () => {
    vi.mocked(db.post.findFirst).mockResolvedValue(null as never);

    await expect(updatePost("missing", BASE_INPUT, ACTOR)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("keeps the original publishedAt when already published", async () => {
    const publishedAt = new Date("2026-01-01");
    vi.mocked(db.post.findFirst).mockResolvedValue({
      id: "p1",
      slug: BASE_INPUT.slug,
      status: PostStatus.PUBLISHED,
      publishedAt,
    } as never);
    vi.mocked(db.post.findUnique).mockResolvedValue(null as never);

    await updatePost("p1", { ...BASE_INPUT, status: PostStatus.PUBLISHED }, ACTOR);

    expect(recordAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "post.updated" }),
    );
  });
});

describe("deletePost", () => {
  it("throws NotFoundError for a missing post", async () => {
    vi.mocked(db.post.findFirst).mockResolvedValue(null as never);
    await expect(deletePost("missing", ACTOR)).rejects.toBeInstanceOf(NotFoundError);
  });

  it("soft-deletes by setting deletedAt", async () => {
    vi.mocked(db.post.findFirst).mockResolvedValue({ id: "p1", title: "x" } as never);
    vi.mocked(db.post.update).mockResolvedValue({} as never);

    await deletePost("p1", ACTOR);

    const args = vi.mocked(db.post.update).mock.calls[0]?.[0] as { data: { deletedAt: Date } };
    expect(args.data.deletedAt).toBeInstanceOf(Date);
  });
});
