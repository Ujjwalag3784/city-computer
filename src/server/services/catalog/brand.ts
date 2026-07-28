/**
 * Brand read path — docs/06-DATA-MODEL.md §4, docs/07-API-DESIGN.md §3.1
 * (`GET /api/v1/brands`, `GET /api/v1/brands/{slug}`).
 */
import "server-only";
import { db } from "@/server/db";
import { Locale, type Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { resolveTranslated } from "./locale-helpers";

export interface BrandSummary {
  id: string;
  slug: string;
  name: string;
  logoId: string | null;
}

export interface BrandDetail extends BrandSummary {
  description: string | null;
  website: string | null;
  isFeatured: boolean;
  metaTitle: string | null;
  metaDescription: string | null;
}

type BrandWithTranslations = Prisma.BrandGetPayload<{ include: { translations: true } }>;

function toBrandSummary(brand: BrandWithTranslations, locale: Locale): BrandSummary {
  return {
    id: brand.id,
    slug: brand.slug,
    name: resolveTranslated(brand.translations, locale, "name", brand.name),
    logoId: brand.logoId,
  };
}

export interface ListBrandsOptions {
  featuredOnly?: boolean;
}

export async function listBrands(
  locale: Locale = Locale.EN,
  options: ListBrandsOptions = {},
): Promise<BrandSummary[]> {
  const brands = await db.brand.findMany({
    where: { isActive: true, ...(options.featuredOnly ? { isFeatured: true } : {}) },
    orderBy: { name: "asc" },
    include: { translations: true },
  });
  return brands.map((brand) => toBrandSummary(brand, locale));
}

export async function getBrandBySlug(
  slug: string,
  locale: Locale = Locale.EN,
): Promise<BrandDetail> {
  const brand = await db.brand.findFirst({
    where: { slug, isActive: true },
    include: { translations: true },
  });
  if (!brand) throw new NotFoundError("Brand");

  return {
    ...toBrandSummary(brand, locale),
    description: resolveTranslated(brand.translations, locale, "description", brand.description),
    website: brand.website,
    isFeatured: brand.isFeatured,
    metaTitle: resolveTranslated(brand.translations, locale, "metaTitle", brand.metaTitle),
    metaDescription: resolveTranslated(
      brand.translations,
      locale,
      "metaDescription",
      brand.metaDescription,
    ),
  };
}

/** Bulk lookup by id, used by `catalog/facet.ts` to hydrate brand facet counts without an N+1. */
export async function getBrandsByIds(ids: string[]): Promise<Map<string, BrandSummary>> {
  if (ids.length === 0) return new Map();
  const brands = await db.brand.findMany({
    where: { id: { in: ids } },
    select: { id: true, slug: true, name: true, logoId: true },
  });
  return new Map(brands.map((brand) => [brand.id, brand]));
}
