/**
 * Category write path — `/admin/categories` (docs/09-ADMIN-DAD-MODE.md §3).
 * The read-only counterpart is `catalog/category.ts`; this file owns
 * everything that mutates a `Category` row, always followed by an
 * `AuditLog` entry (`audit-log.ts`'s `recordAuditLog`) per docs/09 §8's
 * "every mutation appears in Activity History."
 *
 * SCOPE, deliberately narrower than the full docs/06 §4 model for this
 * pass — each one a JUDGMENT CALL, not an oversight:
 *
 * - **No reparenting.** `updateCategory` cannot change `parentId`. Moving
 *   a category to a different parent means recomputing `path`/`depth` for
 *   every descendant (docs/06 §12 #8's "keep `path` consistent with
 *   ancestry" trigger, which — see `prisma/schema/catalog.prisma`'s
 *   `TODO(raw-sql)` comment — has never been applied to a real database
 *   from this sandbox either). `createCategory` computes `path`/`depth`
 *   once, correctly, at insert time; getting the *edit* case right for an
 *   entire subtree is real, separate work, flagged here rather than
 *   half-built.
 * - **No slug editing.** `Category.slug` is immutable after creation in
 *   this pass, same as `Product.slug` documented as "immutable after
 *   publish." The schema's `CategorySlugHistory` table exists for exactly
 *   this eventuality (a slug change that needs an old-link forward) —
 *   wiring that up is a follow-up, not silently ignored.
 * - **Delete is conservative.** `deleteCategory` refuses if the category
 *   has any child categories or any products (by primary category OR
 *   cross-listing), matching docs/09 §8's "Deleting anything else"
 *   guidance one level further than products: rather than a destructive
 *   hard delete, it always soft-deletes (`deletedAt` + `isActive: false`)
 *   so the soft-delete Prisma extension hides it everywhere immediately
 *   while the row (and its id, for any stray foreign key) survives.
 */
import "server-only";
import { db } from "@/server/db";
import { Locale, type Prisma } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { slugify, uniqueSlug } from "@/lib/slug";
import type {
  CreateCategoryInput,
  ReorderCategoriesInput,
  UpdateCategoryInput,
} from "@/lib/validation/admin/category";
import { resolveTranslated } from "@/server/services/catalog/locale-helpers";
import { recordAuditLog, type AuditActor } from "./audit-log";

export interface AdminCategoryNode {
  id: string;
  slug: string;
  path: string;
  depth: number;
  position: number;
  name: string;
  description: string | null;
  iconName: string | null;
  isActive: boolean;
  showInNav: boolean;
  showInFooter: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  /** Direct product count (primary + cross-listed) — what `deleteCategory` itself checks, surfaced here so the UI can grey out "Delete" *before* the user tries and gets a rejection. */
  productCount: number;
  children: AdminCategoryNode[];
}

type CategoryRow = Prisma.CategoryGetPayload<{ include: { translations: true } }>;

function toNodeShell(
  category: CategoryRow,
  productCount: number,
): Omit<AdminCategoryNode, "children"> {
  return {
    id: category.id,
    slug: category.slug,
    path: category.path,
    depth: category.depth,
    position: category.position,
    name: resolveTranslated(category.translations, Locale.EN, "name", category.slug),
    description: resolveTranslated(category.translations, Locale.EN, "description", null),
    iconName: category.iconName,
    isActive: category.isActive,
    showInNav: category.showInNav,
    showInFooter: category.showInFooter,
    metaTitle: category.metaTitle,
    metaDescription: category.metaDescription,
    productCount,
  };
}

/**
 * Every category (active or hidden — this is the admin view, unlike
 * `catalog/category.ts`'s storefront-facing `getCategoryTree`, which only
 * returns nav-eligible ones), nested by `parentId`, ordered by `position`
 * within each level. One query for the rows, one for every level's product
 * counts (`groupBy`, not N+1), then assembled in memory the same way
 * `catalog/category.ts`'s `getCategoryTree` already does.
 */
export async function listCategoriesForAdmin(): Promise<AdminCategoryNode[]> {
  const [categories, productCounts, crossListCounts] = await Promise.all([
    db.category.findMany({
      orderBy: [{ depth: "asc" }, { position: "asc" }],
      include: { translations: true },
    }),
    db.product.groupBy({ by: ["primaryCategoryId"], _count: { _all: true } }),
    db.productCategory.groupBy({ by: ["categoryId"], _count: { _all: true } }),
  ]);

  // A product counts toward its category if it's the primary category OR
  // cross-listed there — de-duplicated per category by unioning the two
  // id sets rather than summing the two counts (a product that is both
  // primary and cross-listed in the same category, which shouldn't
  // normally happen given `seedCatalog`'s own upsert pattern, must still
  // not be double-counted).
  const categoryIdsWithProducts = new Set<string>([
    ...productCounts
      .filter((row) => row.primaryCategoryId !== null)
      .map((row) => row.primaryCategoryId as string),
    ...crossListCounts.map((row) => row.categoryId),
  ]);
  // Exact counts still need a real query per flagged category, not just
  // "has at least one" — but only for categories that actually have any,
  // which keeps this cheap in the common (empty-category) case.
  const exactCounts = await Promise.all(
    [...categoryIdsWithProducts].map(
      async (categoryId) =>
        [
          categoryId,
          await db.product.count({
            where: {
              OR: [{ primaryCategoryId: categoryId }, { categories: { some: { categoryId } } }],
            },
          }),
        ] as const,
    ),
  );
  const productCountByCategoryId = new Map(exactCounts);

  const nodesById = new Map<string, AdminCategoryNode>();
  for (const category of categories) {
    nodesById.set(category.id, {
      ...toNodeShell(category, productCountByCategoryId.get(category.id) ?? 0),
      children: [],
    });
  }

  const roots: AdminCategoryNode[] = [];
  for (const category of categories) {
    // Non-null: every id in `categories` was just inserted into `nodesById` above.
    const node = nodesById.get(category.id) as AdminCategoryNode;
    const parent = category.parentId ? nodesById.get(category.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

async function resolveUniqueSlug(baseSlug: string): Promise<string> {
  const existing = await db.category.findMany({ select: { slug: true } });
  return uniqueSlug(
    baseSlug,
    existing.map((row) => row.slug),
  );
}

/** Computes `path`/`depth` from a (possibly null) parent — the one place both `createCategory` calls compute this identically, matching what `docs/06 §12 #8`'s not-yet-applied trigger would otherwise maintain. */
async function resolvePathAndDepth(
  parentId: string | null,
  slug: string,
): Promise<{ path: string; depth: number }> {
  if (!parentId) return { path: slug, depth: 0 };
  const parent = await db.category.findUnique({
    where: { id: parentId },
    select: { path: true, depth: true },
  });
  if (!parent) throw new NotFoundError("Parent category");
  return { path: `${parent.path}/${slug}`, depth: parent.depth + 1 };
}

export async function createCategory(
  input: CreateCategoryInput,
  actor: AuditActor,
): Promise<AdminCategoryNode> {
  const baseSlug = input.slug ?? slugify(input.name);
  if (!baseSlug) {
    throw new ValidationError([
      { field: "name", code: "invalid", message: "Enter a name we can turn into a website link." },
    ]);
  }
  const slug = await resolveUniqueSlug(baseSlug);
  const { path, depth } = await resolvePathAndDepth(input.parentId, slug);

  const siblingCount = await db.category.count({ where: { parentId: input.parentId } });

  const category = await db.category.create({
    data: {
      slug,
      path,
      depth,
      parentId: input.parentId,
      position: siblingCount,
      iconName: input.iconName ?? null,
      showInNav: input.showInNav,
      showInFooter: input.showInFooter,
      isActive: input.isActive,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      translations: {
        create: {
          locale: Locale.EN,
          name: input.name,
          description: input.description ?? null,
        },
      },
    },
    include: { translations: true },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "category.created",
    entityType: "Category",
    entityId: category.id,
    after: { name: input.name, slug, parentId: input.parentId, isActive: input.isActive },
  });

  return { ...toNodeShell(category, 0), children: [] };
}

export async function updateCategory(
  id: string,
  input: UpdateCategoryInput,
  actor: AuditActor,
): Promise<AdminCategoryNode> {
  const existing = await db.category.findUnique({ where: { id }, include: { translations: true } });
  if (!existing) throw new NotFoundError("Category");

  const before = {
    name: resolveTranslated(existing.translations, Locale.EN, "name", existing.slug),
    description: resolveTranslated(existing.translations, Locale.EN, "description", null),
    isActive: existing.isActive,
    showInNav: existing.showInNav,
    showInFooter: existing.showInFooter,
    iconName: existing.iconName,
    metaTitle: existing.metaTitle,
    metaDescription: existing.metaDescription,
  };

  const updated = await db.category.update({
    where: { id },
    data: {
      iconName: input.iconName ?? null,
      showInNav: input.showInNav,
      showInFooter: input.showInFooter,
      isActive: input.isActive,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      translations: {
        upsert: {
          where: { categoryId_locale: { categoryId: id, locale: Locale.EN } },
          create: { locale: Locale.EN, name: input.name, description: input.description ?? null },
          update: { name: input.name, description: input.description ?? null },
        },
      },
    },
    include: { translations: true },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "category.updated",
    entityType: "Category",
    entityId: id,
    before,
    after: {
      name: input.name,
      description: input.description ?? null,
      isActive: input.isActive,
      showInNav: input.showInNav,
      showInFooter: input.showInFooter,
      iconName: input.iconName ?? null,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
    },
  });

  const productCount = await db.product.count({
    where: { OR: [{ primaryCategoryId: id }, { categories: { some: { categoryId: id } } }] },
  });
  return { ...toNodeShell(updated, productCount), children: [] };
}

/**
 * Applies one drag-and-drop gesture. Rejects (rather than silently
 * partial-applying) if `orderedIds` isn't exactly the current sibling set
 * under `parentId` — a stale client (someone else added/removed a sibling
 * since this page loaded) should surface as a "reload and try again"
 * error, not quietly reorder a subset and drop the rest at whatever
 * position they happened to already have.
 */
export async function reorderCategories(
  input: ReorderCategoriesInput,
  actor: AuditActor,
): Promise<void> {
  const siblings = await db.category.findMany({
    where: { parentId: input.parentId },
    select: { id: true },
  });
  const siblingIds = new Set(siblings.map((s) => s.id));
  const orderedIdSet = new Set(input.orderedIds);

  if (
    siblingIds.size !== orderedIdSet.size ||
    ![...siblingIds].every((id) => orderedIdSet.has(id))
  ) {
    throw new ValidationError([
      {
        field: "orderedIds",
        code: "stale",
        message: "This list has changed since you loaded it. Reload and try again.",
      },
    ]);
  }

  await db.$transaction(
    input.orderedIds.map((categoryId, index) =>
      db.category.update({ where: { id: categoryId }, data: { position: index } }),
    ),
  );

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "category.reordered",
    entityType: "Category",
    entityId: input.parentId ?? "root",
    after: { orderedIds: input.orderedIds },
  });
}

/**
 * Always a soft delete (see this file's header comment) — refuses
 * entirely if the category has children or products, since docs/09 §8
 * gives no "hide it instead" escape hatch the way it does for products
 * with order history; a category with real content underneath it isn't
 * safe to remove even from view without dealing with that content first.
 */
export async function deleteCategory(id: string, actor: AuditActor): Promise<void> {
  const category = await db.category.findUnique({
    where: { id },
    include: { translations: true, _count: { select: { children: true } } },
  });
  if (!category) throw new NotFoundError("Category");

  if (category._count.children > 0) {
    throw new ValidationError([
      {
        field: "id",
        code: "has_children",
        message: "This category has other categories inside it. Move or remove those first.",
      },
    ]);
  }

  const productCount = await db.product.count({
    where: { OR: [{ primaryCategoryId: id }, { categories: { some: { categoryId: id } } }] },
  });
  if (productCount > 0) {
    throw new ValidationError([
      {
        field: "id",
        code: "has_products",
        message: `This category still has ${productCount} product${productCount === 1 ? "" : "s"} in it. Move them to another category first.`,
      },
    ]);
  }

  await db.category.update({
    where: { id },
    data: { isActive: false, deletedAt: new Date() },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "category.deleted",
    entityType: "Category",
    entityId: id,
    before: { name: resolveTranslated(category.translations, Locale.EN, "name", category.slug) },
  });
}
