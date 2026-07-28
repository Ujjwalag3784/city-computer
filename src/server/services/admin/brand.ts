/**
 * Brand write path — `/admin/brands` (docs/09-ADMIN-DAD-MODE.md §3). The
 * read-only counterpart is `catalog/brand.ts`.
 *
 * NO DRAG ORDERING: unlike `Category`, `Brand` has no `position` column
 * in `prisma/schema/catalog.prisma` — `catalog/brand.ts`'s own
 * `listBrands` already sorts alphabetically (`orderBy: { name: "asc" }`),
 * and there is nowhere to persist a custom order even if the admin UI
 * offered to let someone drag one. docs/17-ROADMAP-PHASES.md's Phase 5
 * deliverable line ("categories and brands management with drag
 * ordering") is read here as applying to categories, which do have the
 * column; adding brand ordering would need its own migration, out of
 * reach in this sandbox the same way `RecoveryCode` and the search-vector
 * trigger are — flagged rather than faked with a client-only reorder that
 * would silently reset on reload.
 *
 * Delete is conservative the same way `admin/category.ts`'s is: refuses
 * if the brand has any products at all (soft-deleted or not — a brand
 * with order history behind those products absolutely should not
 * disappear), always soft-deletes otherwise.
 */
import "server-only";
import { db } from "@/server/db";
import { Locale, type Prisma } from "@/generated/prisma/client";
import { NotFoundError, ValidationError } from "@/lib/errors";
import { slugify, uniqueSlug } from "@/lib/slug";
import type { CreateBrandInput, UpdateBrandInput } from "@/lib/validation/admin/brand";
import { resolveTranslated } from "@/server/services/catalog/locale-helpers";
import { recordAuditLog, type AuditActor } from "./audit-log";

export interface AdminBrandRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  website: string | null;
  logoId: string | null;
  isFeatured: boolean;
  isActive: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
  productCount: number;
}

type BrandRow = Prisma.BrandGetPayload<{ include: { translations: true } }>;

function toBrandRow(brand: BrandRow, productCount: number): AdminBrandRow {
  return {
    id: brand.id,
    slug: brand.slug,
    name: resolveTranslated(brand.translations, Locale.EN, "name", brand.name),
    description: resolveTranslated(brand.translations, Locale.EN, "description", brand.description),
    website: brand.website,
    logoId: brand.logoId,
    isFeatured: brand.isFeatured,
    isActive: brand.isActive,
    metaTitle: brand.metaTitle,
    metaDescription: brand.metaDescription,
    productCount,
  };
}

/** Every brand (active or hidden), alphabetical — the admin equivalent of `catalog/brand.ts`'s `listBrands`, minus the `isActive: true` filter. */
export async function listBrandsForAdmin(): Promise<AdminBrandRow[]> {
  const [brands, productCounts] = await Promise.all([
    db.brand.findMany({ orderBy: { name: "asc" }, include: { translations: true } }),
    db.product.groupBy({ by: ["brandId"], _count: { _all: true } }),
  ]);
  const countByBrandId = new Map(productCounts.map((row) => [row.brandId, row._count._all]));
  return brands.map((brand) => toBrandRow(brand, countByBrandId.get(brand.id) ?? 0));
}

async function resolveUniqueSlug(baseSlug: string): Promise<string> {
  const existing = await db.brand.findMany({ select: { slug: true } });
  return uniqueSlug(
    baseSlug,
    existing.map((row) => row.slug),
  );
}

export async function createBrand(
  input: CreateBrandInput,
  actor: AuditActor,
): Promise<AdminBrandRow> {
  const baseSlug = input.slug ?? slugify(input.name);
  if (!baseSlug) {
    throw new ValidationError([
      { field: "name", code: "invalid", message: "Enter a name we can turn into a website link." },
    ]);
  }
  const slug = await resolveUniqueSlug(baseSlug);

  const brand = await db.brand.create({
    data: {
      slug,
      name: input.name,
      description: input.description ?? null,
      website: input.website ?? null,
      logoId: input.logoId ?? null,
      isFeatured: input.isFeatured,
      isActive: input.isActive,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
    },
    include: { translations: true },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "brand.created",
    entityType: "Brand",
    entityId: brand.id,
    after: { name: input.name, slug, isActive: input.isActive },
  });

  return toBrandRow(brand, 0);
}

export async function updateBrand(
  id: string,
  input: UpdateBrandInput,
  actor: AuditActor,
): Promise<AdminBrandRow> {
  const existing = await db.brand.findUnique({ where: { id }, include: { translations: true } });
  if (!existing) throw new NotFoundError("Brand");

  const before = toBrandRow(existing, 0);

  const updated = await db.brand.update({
    where: { id },
    data: {
      name: input.name,
      description: input.description ?? null,
      website: input.website ?? null,
      logoId: input.logoId ?? null,
      isFeatured: input.isFeatured,
      isActive: input.isActive,
      metaTitle: input.metaTitle ?? null,
      metaDescription: input.metaDescription ?? null,
      // Base `name`/`description` columns are what `catalog/brand.ts`
      // falls back to when no translation row exists — kept in sync here
      // so an admin who never touches translations still sees their edit
      // reflected everywhere immediately.
      translations: {
        upsert: {
          where: { brandId_locale: { brandId: id, locale: Locale.EN } },
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
    action: "brand.updated",
    entityType: "Brand",
    entityId: id,
    before: { name: before.name, description: before.description, isActive: before.isActive },
    after: { name: input.name, description: input.description ?? null, isActive: input.isActive },
  });

  const productCount = await db.product.count({ where: { brandId: id } });
  return toBrandRow(updated, productCount);
}

export async function deleteBrand(id: string, actor: AuditActor): Promise<void> {
  const brand = await db.brand.findUnique({ where: { id }, include: { translations: true } });
  if (!brand) throw new NotFoundError("Brand");

  const productCount = await db.product.count({ where: { brandId: id } });
  if (productCount > 0) {
    throw new ValidationError([
      {
        field: "id",
        code: "has_products",
        message: `This brand still has ${productCount} product${productCount === 1 ? "" : "s"}. Move them to another brand first.`,
      },
    ]);
  }

  await db.brand.update({ where: { id }, data: { isActive: false, deletedAt: new Date() } });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "brand.deleted",
    entityType: "Brand",
    entityId: id,
    before: { name: resolveTranslated(brand.translations, Locale.EN, "name", brand.name) },
  });
}
