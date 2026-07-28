/**
 * Category read path — docs/06-DATA-MODEL.md §4, docs/07-API-DESIGN.md
 * §3.1 (`GET /api/v1/categories`, `GET /api/v1/categories/{path}`).
 *
 * Everything here reads the materialised `Category.path` column
 * (`laptops/gaming`) rather than walking `parentId` recursively — that is
 * the entire point of storing it (docs/06 §4: "enables `/c/[...slug]` in
 * one query"). The one place we still need ancestry logic is descendant
 * resolution (`getCategoryDescendantIds`), and even that is a single
 * `LIKE`-style prefix query (`path` equals or starts with `${path}/`),
 * not a recursive CTE.
 */
import "server-only";
import { db } from "@/server/db";
import { Locale, type Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { resolveTranslated } from "./locale-helpers";

export interface CategorySummary {
  id: string;
  slug: string;
  path: string;
  depth: number;
  name: string;
  imageId: string | null;
  iconName: string | null;
}

export interface CategoryTreeNode extends CategorySummary {
  children: CategoryTreeNode[];
}

export interface CategoryDetail extends CategorySummary {
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  /** Drives the storefront facet definitions for this category (docs/06 §4) — see `catalog/facet.ts`'s `getFilterableSpecKeys`. */
  specTemplateId: string | null;
}

type CategoryWithTranslations = Prisma.CategoryGetPayload<{ include: { translations: true } }>;

function toCategorySummary(category: CategoryWithTranslations, locale: Locale): CategorySummary {
  return {
    id: category.id,
    slug: category.slug,
    path: category.path,
    depth: category.depth,
    name: resolveTranslated(category.translations, locale, "name", category.slug),
    imageId: category.imageId,
    iconName: category.iconName,
  };
}

/**
 * Full nav-eligible category tree, nested by `parentId`. Used for
 * `SiteHeader`'s mega-menu and the footer category list (docs/06 §8's
 * `Menu`/`MenuItem` model is the *curated* nav; this is the raw catalogue
 * tree fallback docs/04's `config/navigation.ts` static list exists
 * alongside).
 */
export async function getCategoryTree(locale: Locale = Locale.EN): Promise<CategoryTreeNode[]> {
  const categories = await db.category.findMany({
    where: { isActive: true, showInNav: true },
    orderBy: [{ depth: "asc" }, { position: "asc" }],
    include: { translations: true },
  });

  const nodesById = new Map<string, CategoryTreeNode>();
  for (const category of categories) {
    nodesById.set(category.id, { ...toCategorySummary(category, locale), children: [] });
  }

  const roots: CategoryTreeNode[] = [];
  for (const category of categories) {
    // Non-null: every id in `categories` was just inserted into `nodesById` above.
    const node = nodesById.get(category.id) as CategoryTreeNode;
    const parent = category.parentId ? nodesById.get(category.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      // A category whose parent is inactive/hidden-from-nav still needs
      // to render *somewhere* rather than silently vanish from the tree —
      // it surfaces as its own root. This should be rare in well-curated
      // data but is a deliberate fail-safe, not an assumption that it
      // never happens.
      roots.push(node);
    }
  }

  return roots;
}

/** `/c/[...categorySlug]` resolves against the materialised path, e.g. `laptops/gaming` — one query, no ancestry walk. */
export async function getCategoryByPath(
  path: string,
  locale: Locale = Locale.EN,
): Promise<CategoryDetail> {
  const category = await db.category.findFirst({
    where: { path, isActive: true },
    include: { translations: true },
  });
  if (!category) throw new NotFoundError("Category");

  return {
    ...toCategorySummary(category, locale),
    description: resolveTranslated(category.translations, locale, "description", null),
    metaTitle: resolveTranslated(category.translations, locale, "metaTitle", category.metaTitle),
    metaDescription: resolveTranslated(
      category.translations,
      locale,
      "metaDescription",
      category.metaDescription,
    ),
    specTemplateId: category.specTemplateId,
  };
}

export async function getCategoryBySlug(
  slug: string,
  locale: Locale = Locale.EN,
): Promise<CategoryDetail> {
  const category = await db.category.findFirst({
    where: { slug, isActive: true },
    include: { translations: true },
  });
  if (!category) throw new NotFoundError("Category");
  return getCategoryByPath(category.path, locale);
}

/**
 * A category plus every descendant's id, by materialised-path prefix
 * match — "everything under Laptops" without a recursive query. This is
 * what makes `?category=laptops` (no `/gaming` suffix) include Gaming
 * Laptops, Business Laptops, etc. in `catalog/product.ts`'s `listProducts`.
 */
export async function getCategoryDescendantIds(categoryId: string): Promise<string[]> {
  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { id: true, path: true },
  });
  if (!category) throw new NotFoundError("Category");

  const descendants = await db.category.findMany({
    where: { OR: [{ id: category.id }, { path: { startsWith: `${category.path}/` } }] },
    select: { id: true },
  });

  return descendants.map((descendant) => descendant.id);
}

/** Convenience wrapper: resolve a category *path* straight to its full descendant-id set, for callers (`listProducts`) that only have the path from a URL segment, not an id yet. */
export async function getCategoryDescendantIdsByPath(path: string): Promise<string[]> {
  const category = await db.category.findFirst({
    where: { path, isActive: true },
    select: { id: true },
  });
  if (!category) throw new NotFoundError("Category");
  return getCategoryDescendantIds(category.id);
}

export interface CategoryBreadcrumbSegment {
  slug: string;
  path: string;
  name: string;
}

/**
 * The full ancestor chain for a category page's breadcrumb trail — e.g.
 * `laptops/gaming` → `[{ path: "laptops", name: "Laptops" }, { path:
 * "laptops/gaming", name: "Gaming Laptops" }]`. One query for every
 * segment (a `path IN (...)` on the pre-computed cumulative prefixes),
 * not one query per ancestor level.
 *
 * A missing ancestor (deactivated, or `path` drifted out of sync with
 * `parentId` — see the `TODO(raw-sql)` on `Category.path` in
 * `catalog.prisma`) is silently skipped rather than thrown: a breadcrumb
 * with a gap in it is a cosmetic problem, not a reason to break the page
 * it's decorating.
 */
export async function getCategoryBreadcrumbTrail(
  path: string,
  locale: Locale = Locale.EN,
): Promise<CategoryBreadcrumbSegment[]> {
  const segments = path.split("/");
  const cumulativePaths = segments.map((_, index) => segments.slice(0, index + 1).join("/"));

  const categories = await db.category.findMany({
    where: { path: { in: cumulativePaths }, isActive: true },
    include: { translations: true },
  });
  const categoryByPath = new Map(categories.map((category) => [category.path, category]));

  return cumulativePaths
    .map((cumulativePath) => {
      const category = categoryByPath.get(cumulativePath);
      if (!category) return null;
      return {
        slug: category.slug,
        path: category.path,
        name: resolveTranslated(category.translations, locale, "name", category.slug),
      };
    })
    .filter((segment): segment is CategoryBreadcrumbSegment => segment !== null);
}
