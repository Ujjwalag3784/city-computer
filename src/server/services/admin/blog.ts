/**
 * `/admin/blog` — CRUD over `Post` plus its `PostCategory`/`PostTag`/
 * `PostProduct` joins and a minimal `Author` directory (docs/17 Phase 10:
 * "Blog with categories, authors, Tiptap editor, sanitised rendering,
 * reading time, related products").
 *
 * Category/tag/related-product assignment uses the same "comma-separated
 * codes, a picker is coming later" simplification `admin/coupons.ts`'s
 * `targetIdsText` already established for this codebase (see that file's
 * own doc comment) — slugs are validated to actually exist and a bad slug
 * fails the whole save with a plain-language list of which ones, rather
 * than silently dropping them.
 *
 * `content` is never trusted as-is: `parseTiptapDocument` (the JSON
 * allow-list gate, `src/lib/tiptap/schema.ts`) MUST accept it before this
 * file writes anything to `Post.content` — this is the enforcement point
 * for docs/17 Phase 10's "no raw HTML is ever accepted or stored" bar.
 * `readingMinutes` is computed here, server-side, from the same validated
 * document — never trusted from the client.
 */
import "server-only";
import { db } from "@/server/db";
import { PostStatus, type Prisma } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { parseTiptapDocument } from "@/lib/tiptap/schema";
import { calculateReadingMinutes } from "@/lib/tiptap/reading-time";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import type {
  AdminPostFilter,
  AdminPostListQuery,
  PostFormInput,
} from "@/lib/validation/admin/blog";

const POST_LIST_PAGE_SIZE = 20;

export interface AdminPostListItem {
  id: string;
  title: string;
  slug: string;
  status: PostStatus;
  authorName: string;
  publishedAt: Date | null;
  updatedAt: Date;
}

function buildListWhere(query: AdminPostListQuery): Prisma.PostWhereInput {
  const clauses: Prisma.PostWhereInput[] = [{ deletedAt: null }];
  if (query.q) {
    clauses.push({
      OR: [
        { title: { contains: query.q, mode: "insensitive" } },
        { slug: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  const filter: AdminPostFilter = query.filter;
  if (filter !== "all") clauses.push({ status: filter.toUpperCase() as PostStatus });
  return { AND: clauses };
}

export async function listPostsForAdmin(
  query: AdminPostListQuery,
): Promise<{ items: AdminPostListItem[]; total: number; hasNext: boolean }> {
  const where = buildListWhere(query);
  const [rows, total] = await Promise.all([
    db.post.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (query.page - 1) * POST_LIST_PAGE_SIZE,
      take: POST_LIST_PAGE_SIZE + 1,
      include: { author: { select: { name: true } } },
    }),
    db.post.count({ where }),
  ]);
  const hasNext = rows.length > POST_LIST_PAGE_SIZE;
  return {
    items: rows.slice(0, POST_LIST_PAGE_SIZE).map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      status: p.status,
      authorName: p.author.name,
      publishedAt: p.publishedAt,
      updatedAt: p.updatedAt,
    })),
    total,
    hasNext,
  };
}

export interface AdminPostDetail {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: unknown;
  authorId: string;
  status: PostStatus;
  categorySlugs: string[];
  tags: string[];
  relatedProductSlugs: string[];
  coverMediaId: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  readingMinutes: number | null;
}

export async function getPostForAdmin(postId: string): Promise<AdminPostDetail> {
  const post = await db.post.findFirst({
    where: { id: postId, deletedAt: null },
    include: {
      categories: { include: { category: { select: { slug: true } } } },
      tags: { orderBy: { position: "asc" } },
      products: { include: { product: { select: { slug: true } } } },
    },
  });
  if (!post) throw new NotFoundError("Blog post");

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt,
    content: post.content,
    authorId: post.authorId,
    status: post.status,
    categorySlugs: post.categories.map((c) => c.category.slug),
    tags: post.tags.map((t) => t.tag),
    relatedProductSlugs: post.products.map((p) => p.product.slug),
    coverMediaId: post.coverMediaId,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    readingMinutes: post.readingMinutes,
  };
}

function parseCommaSeparated(text: string | undefined): string[] {
  if (!text) return [];
  return [
    ...new Set(
      text
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean),
    ),
  ];
}

/** Resolves category/product slugs to ids, throwing a plain-language `ValidationError` listing exactly which slugs don't exist — never a silent drop. */
async function resolveCategoryIds(slugs: string[]): Promise<string[]> {
  if (slugs.length === 0) return [];
  const rows = await db.category.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const found = new Set(rows.map((r) => r.slug));
  const missing = slugs.filter((s) => !found.has(s));
  if (missing.length > 0) {
    throw new ValidationError([
      {
        field: "categorySlugsText",
        code: "unknown_slug",
        message: `Unknown category code(s): ${missing.join(", ")}`,
      },
    ]);
  }
  return rows.map((r) => r.id);
}

async function resolveProductIds(slugs: string[]): Promise<{ id: string }[]> {
  if (slugs.length === 0) return [];
  const rows = await db.product.findMany({
    where: { slug: { in: slugs } },
    select: { id: true, slug: true },
  });
  const found = new Set(rows.map((r) => r.slug));
  const missing = slugs.filter((s) => !found.has(s));
  if (missing.length > 0) {
    throw new ValidationError([
      {
        field: "relatedProductSlugsText",
        code: "unknown_slug",
        message: `Unknown product code(s): ${missing.join(", ")}`,
      },
    ]);
  }
  return rows.map((r) => ({ id: r.id }));
}

/** Validates `input.content` against the Tiptap JSON allow-list. Throws if it doesn't match — the save is refused outright, never partially accepted. */
function parseAndValidateContent(rawContent: unknown) {
  const parsed = parseTiptapDocument(rawContent);
  if (!parsed) {
    throw new ValidationError([
      {
        field: "content",
        code: "invalid_content",
        message:
          "This post's content couldn't be saved safely. Try removing any unusual formatting and save again.",
      },
    ]);
  }
  return parsed;
}

export async function createPost(input: PostFormInput, actor: AuditActor): Promise<{ id: string }> {
  const existingSlug = await db.post.findUnique({ where: { slug: input.slug } });
  if (existingSlug) {
    throw new ValidationError([
      {
        field: "slug",
        code: "duplicate",
        message: "This URL slug is already used by another post.",
      },
    ]);
  }

  const contentDoc = parseAndValidateContent(input.content);
  const readingMinutes = calculateReadingMinutes(contentDoc);
  const categoryIds = await resolveCategoryIds(parseCommaSeparated(input.categorySlugsText));
  const productRefs = await resolveProductIds(parseCommaSeparated(input.relatedProductSlugsText));
  const tags = parseCommaSeparated(input.tagsText);

  const post = await db.post.create({
    data: {
      title: input.title.trim(),
      slug: input.slug,
      excerpt: input.excerpt?.trim() || null,
      // `contentDoc` is a plain JSON-serialisable object already validated by
      // `parseAndValidateContent`'s Tiptap allow-list — this cast bridges
      // the Zod-inferred `TiptapDocument` type to Prisma's structurally
      // different (but compatible at runtime) `InputJsonValue`.
      content: contentDoc as unknown as Prisma.InputJsonValue,
      readingMinutes,
      authorId: input.authorId,
      status: input.status,
      publishedAt: input.status === PostStatus.PUBLISHED ? new Date() : null,
      coverMediaId: input.coverMediaId?.trim() || null,
      metaTitle: input.metaTitle?.trim() || null,
      metaDescription: input.metaDescription?.trim() || null,
      categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      tags: { create: tags.map((tag, position) => ({ tag, position })) },
      products: { create: productRefs.map((p, position) => ({ productId: p.id, position })) },
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "post.created",
    entityType: "Post",
    entityId: post.id,
    after: { title: post.title, status: post.status },
  });

  return { id: post.id };
}

export async function updatePost(
  postId: string,
  input: PostFormInput,
  actor: AuditActor,
): Promise<void> {
  const before = await db.post.findFirst({ where: { id: postId, deletedAt: null } });
  if (!before) throw new NotFoundError("Blog post");

  if (input.slug !== before.slug) {
    const clash = await db.post.findUnique({ where: { slug: input.slug } });
    if (clash) {
      throw new ValidationError([
        {
          field: "slug",
          code: "duplicate",
          message: "This URL slug is already used by another post.",
        },
      ]);
    }
  }

  const contentDoc = parseAndValidateContent(input.content);
  const readingMinutes = calculateReadingMinutes(contentDoc);
  const categoryIds = await resolveCategoryIds(parseCommaSeparated(input.categorySlugsText));
  const productRefs = await resolveProductIds(parseCommaSeparated(input.relatedProductSlugsText));
  const tags = parseCommaSeparated(input.tagsText);

  const isNewlyPublished =
    input.status === PostStatus.PUBLISHED && before.status !== PostStatus.PUBLISHED;

  await db.$transaction([
    db.postCategory.deleteMany({ where: { postId } }),
    db.postTag.deleteMany({ where: { postId } }),
    db.postProduct.deleteMany({ where: { postId } }),
    db.post.update({
      where: { id: postId },
      data: {
        title: input.title.trim(),
        slug: input.slug,
        excerpt: input.excerpt?.trim() || null,
        content: contentDoc as unknown as Prisma.InputJsonValue,
        readingMinutes,
        authorId: input.authorId,
        status: input.status,
        publishedAt: isNewlyPublished ? new Date() : before.publishedAt,
        coverMediaId: input.coverMediaId?.trim() || null,
        metaTitle: input.metaTitle?.trim() || null,
        metaDescription: input.metaDescription?.trim() || null,
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        tags: { create: tags.map((tag, position) => ({ tag, position })) },
        products: { create: productRefs.map((p, position) => ({ productId: p.id, position })) },
      },
    }),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "post.updated",
    entityType: "Post",
    entityId: postId,
    before: { status: before.status },
    after: { status: input.status },
  });
}

export async function deletePost(postId: string, actor: AuditActor): Promise<void> {
  const before = await db.post.findFirst({ where: { id: postId, deletedAt: null } });
  if (!before) throw new NotFoundError("Blog post");

  await db.post.update({ where: { id: postId }, data: { deletedAt: new Date() } });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "post.deleted",
    entityType: "Post",
    entityId: postId,
    before: { title: before.title },
  });
}

// ---------------------------------------------------------------------------
// Authors — a minimal directory (name + bio), no `userId` linking UI yet.
// ---------------------------------------------------------------------------

export interface AdminAuthorListItem {
  id: string;
  name: string;
  bio: string | null;
  postCount: number;
}

export async function listAuthorsForAdmin(): Promise<AdminAuthorListItem[]> {
  const authors = await db.author.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { posts: true } } },
  });
  return authors.map((a) => ({ id: a.id, name: a.name, bio: a.bio, postCount: a._count.posts }));
}

export async function createAuthor(
  input: { name: string; bio?: string },
  actor: AuditActor,
): Promise<{ id: string }> {
  const author = await db.author.create({
    data: { name: input.name.trim(), bio: input.bio?.trim() || null },
  });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "author.created",
    entityType: "Author",
    entityId: author.id,
    after: { name: author.name },
  });
  return { id: author.id };
}
