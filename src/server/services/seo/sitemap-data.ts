/**
 * docs/11-SEO-STRATEGY.md §5.1-§5.3: the read path behind `src/app/
 * sitemap.ts`. Each function returns only what a sitemap entry needs
 * (`slug`, `updatedAt`) and only for rows that are actually indexable —
 * "A URL belongs in a sitemap only if it returns 200, is index,follow,
 * and is self-canonical" (§5.2) — so `sitemap.ts` itself never has to
 * re-derive an inclusion rule; a row this file returns is a row that
 * belongs in the sitemap, full stop.
 *
 * Exclusions applied here per §5.3's table: `ProductStatus.DRAFT`/
 * `ARCHIVED` products, inactive categories/brands/branches, and
 * non-`PUBLISHED` posts/pages are never selected. Paginated URLs
 * (`?page=2+`) are deliberately never listed (§5.3: "Discoverable via
 * page-1 links") — only the canonical, unfiltered entity URL.
 */
import "server-only";
import { db } from "@/server/db";
import { PostStatus, ProductStatus } from "@/generated/prisma/client";

export interface SitemapRow {
  slug: string;
  updatedAt: Date;
}

export async function listSitemapProducts(): Promise<SitemapRow[]> {
  return db.product.findMany({
    where: { status: ProductStatus.ACTIVE, deletedAt: null },
    select: { slug: true, updatedAt: true },
    orderBy: { slug: "asc" },
  });
}

export async function listSitemapCategories(): Promise<SitemapRow[]> {
  const rows = await db.category.findMany({
    where: { isActive: true, deletedAt: null },
    select: { path: true, updatedAt: true },
    orderBy: { path: "asc" },
  });
  return rows.map((row) => ({ slug: row.path, updatedAt: row.updatedAt }));
}

export async function listSitemapBrands(): Promise<SitemapRow[]> {
  return db.brand.findMany({
    where: { isActive: true, deletedAt: null },
    select: { slug: true, updatedAt: true },
    orderBy: { slug: "asc" },
  });
}

export async function listSitemapPosts(): Promise<SitemapRow[]> {
  return db.post.findMany({
    where: { status: PostStatus.PUBLISHED, deletedAt: null },
    select: { slug: true, updatedAt: true },
    orderBy: { slug: "asc" },
  });
}

export async function listSitemapPages(): Promise<SitemapRow[]> {
  return db.page.findMany({
    where: { status: PostStatus.PUBLISHED, deletedAt: null },
    select: { slug: true, updatedAt: true },
    orderBy: { slug: "asc" },
  });
}

export async function listSitemapBranches(): Promise<SitemapRow[]> {
  return db.branch.findMany({
    where: { isActive: true },
    select: { slug: true, updatedAt: true },
    orderBy: { slug: "asc" },
  });
}
