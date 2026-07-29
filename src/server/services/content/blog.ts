/**
 * Public blog read path — `/blog`, `/blog/[slug]`, `/blog/category/[slug]`
 * (docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md's route table, ISR 600s). Never
 * returns a draft/scheduled/archived post or its content — `status:
 * PUBLISHED` is baked into every query here, not left to the caller to
 * remember.
 */
import "server-only";
import { db } from "@/server/db";
import { PostStatus, type Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { parseTiptapDocument, type TiptapDocument } from "@/lib/tiptap/schema";
import { getProductSummariesByIds, type ProductSummary } from "@/server/services/catalog/product";

const POSTS_PER_PAGE = 12;

export interface PublicPostListItem {
  slug: string;
  title: string;
  excerpt: string | null;
  authorName: string;
  publishedAt: Date | null;
  readingMinutes: number;
  categorySlugs: string[];
}

export interface ListPublicPostsResult {
  items: PublicPostListItem[];
  total: number;
  page: number;
  totalPages: number;
}

export async function listPublicPosts(
  page = 1,
  categorySlug?: string,
): Promise<ListPublicPostsResult> {
  const where: Prisma.PostWhereInput = {
    status: PostStatus.PUBLISHED,
    deletedAt: null,
    ...(categorySlug ? { categories: { some: { category: { slug: categorySlug } } } } : {}),
  };

  const [rows, total] = await Promise.all([
    db.post.findMany({
      where,
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * POSTS_PER_PAGE,
      take: POSTS_PER_PAGE,
      include: {
        author: { select: { name: true } },
        categories: { include: { category: { select: { slug: true } } } },
      },
    }),
    db.post.count({ where }),
  ]);

  return {
    items: rows.map((p) => ({
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt,
      authorName: p.author.name,
      publishedAt: p.publishedAt,
      readingMinutes: p.readingMinutes ?? 1,
      categorySlugs: p.categories.map((c) => c.category.slug),
    })),
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / POSTS_PER_PAGE)),
  };
}

export interface PublicPostDetail {
  slug: string;
  title: string;
  excerpt: string | null;
  content: TiptapDocument;
  authorName: string;
  authorBio: string | null;
  publishedAt: Date | null;
  readingMinutes: number;
  metaTitle: string | null;
  metaDescription: string | null;
  categorySlugs: string[];
  tags: string[];
  relatedProducts: ProductSummary[];
}

export async function getPublicPostBySlug(slug: string): Promise<PublicPostDetail> {
  const post = await db.post.findFirst({
    where: { slug, status: PostStatus.PUBLISHED, deletedAt: null },
    include: {
      author: { select: { name: true, bio: true } },
      categories: { include: { category: { select: { slug: true } } } },
      tags: { orderBy: { position: "asc" } },
      products: { orderBy: { position: "asc" }, select: { productId: true } },
    },
  });
  if (!post) throw new NotFoundError("Blog post");

  // `Post.content` was validated against the Tiptap allow-list at save time
  // (`admin/blog.ts`'s `createPost`/`updatePost`) — re-validating on every
  // read is a defence-in-depth belt-and-braces check, not the primary gate,
  // so a row that somehow fails here renders as an empty body rather than
  // ever falling back to an unsanitised string.
  const content = parseTiptapDocument(post.content) ?? { type: "doc" as const, content: [] };

  const relatedProducts = await getProductSummariesByIds(post.products.map((p) => p.productId));

  // Fire-and-forget view counter — same "never let observability block the
  // real read" pattern as `recordAuditLog`/`logSearchQuery`.
  db.post
    .update({ where: { id: post.id }, data: { viewCount: { increment: 1 } } })
    .catch(() => undefined);

  return {
    slug: post.slug,
    title: post.title,
    excerpt: post.excerpt,
    content,
    authorName: post.author.name,
    authorBio: post.author.bio,
    publishedAt: post.publishedAt,
    readingMinutes: post.readingMinutes ?? 1,
    metaTitle: post.metaTitle,
    metaDescription: post.metaDescription,
    categorySlugs: post.categories.map((c) => c.category.slug),
    tags: post.tags.map((t) => t.tag),
    relatedProducts,
  };
}
