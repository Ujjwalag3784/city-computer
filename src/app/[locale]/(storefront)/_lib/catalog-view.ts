/**
 * Server-side view-model glue for the storefront route tree
 * (`(storefront)/{page,c,b,p,search}`).
 *
 * ARCHITECTURE NOTE: this file lives under `app/`, which is the one layer
 * allowed to depend on both `server/services/**` and `components/**`
 * (docs/04 §3's dependency diagram). Its whole job is translating between
 * the two: the catalog service layer's `ProductSummary`/`CatalogFacets`/
 * `PaginationMeta` on one side, and `components/commerce`'s plain,
 * server-agnostic `ProductCardData`/`CatalogListingFacets`/
 * `CatalogListingPagination` DTOs on the other. Neither layer imports the
 * other directly — this file is the only place both types are in scope
 * at once.
 */
import "server-only";
import { ConditionType, Locale } from "@/generated/prisma/client";
import {
  productAvailabilitySchema,
  productListInputSchema,
  productSortSchema,
  type ProductAvailability,
  type ProductListInput,
  type ProductSort,
} from "@/lib/validation/catalog";
import { rupeesToPaisa } from "@/lib/money";
import type { ProductSummary } from "@/server/services/catalog/product";
import type { CatalogFacets } from "@/server/services/catalog/facet";
import type { PaginationMeta } from "@/server/services/catalog/locale-helpers";
import type { ProductCardData } from "@/components/commerce/product-card";
import type {
  CatalogListingFacets,
  CatalogListingPagination,
} from "@/components/commerce/catalog-listing";

/**
 * A fully transparent 1×1 GIF, used as `ProductCardData.imageUrl` when a
 * product has no media row at all. Renders as an empty box against
 * `ProductCard`'s `bg-surface-container-high`, not a broken-image icon.
 * Distinct from (and a fallback of last resort *behind*) the seed data's
 * own placeholder media rows, which point at `.avif` files that were
 * never actually generated (`prisma/seed/catalog.ts`: "real photography
 * happens in Phase 5+") — those will 404 through `next/image` exactly as
 * intended until real product photography exists; this constant only
 * covers the case where there is no media row to even attempt.
 */
const PLACEHOLDER_PRODUCT_IMAGE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export function toProductCardData(summary: ProductSummary): ProductCardData {
  return {
    slug: summary.slug,
    imageUrl: summary.image?.url ?? PLACEHOLDER_PRODUCT_IMAGE,
    imageAlt: summary.image?.alt ?? summary.displayTitle,
    displayTitle: summary.displayTitle,
    brand: summary.brand.name,
    price: summary.priceFrom.amountPaisa,
    compareAtPrice: summary.priceFrom.compareAtPaisa ?? undefined,
    rating: summary.rating.average ?? undefined,
    reviewCount: summary.rating.count,
    stockStatus: summary.availability === "IN_STOCK" ? "in-stock" : "out-of-stock",
  };
}

export function toCatalogListingFacets(facets: CatalogFacets): CatalogListingFacets {
  return {
    brands: facets.brands.map((brand) => ({
      slug: brand.slug,
      name: brand.name,
      count: brand.count,
    })),
    specs: facets.specs.map((spec) =>
      spec.dataType === "TEXT"
        ? { key: spec.key, label: spec.label, dataType: "TEXT", options: spec.options }
        : {
            key: spec.key,
            label: spec.label,
            dataType: "NUMBER",
            min: spec.min,
            max: spec.max,
            unit: spec.unit,
          },
    ),
    priceRangePaisa: facets.priceRange
      ? { min: facets.priceRange.minPaisa, max: facets.priceRange.maxPaisa }
      : null,
  };
}

export function toCatalogListingPagination(meta: PaginationMeta): CatalogListingPagination {
  return { page: meta.page, totalPages: meta.totalPages, total: meta.total, hasNext: meta.hasNext };
}

/** next-intl's `[locale]` segment (`"en" | "ne"`) → the Prisma `Locale` enum the catalog service layer speaks. Kept here, not in the service layer, so `server/services/catalog/**` stays decoupled from which i18n library the app happens to use. */
export function toPrismaLocale(locale: string): Locale {
  return locale === "ne" ? Locale.NE : Locale.EN;
}

export type StorefrontSearchParams = Record<string, string | string[] | undefined>;

export function firstValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function allValues(value: string | string[] | undefined): string[] {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function sanitizedNumber(value: string | string[] | undefined): number | undefined {
  const raw = firstValue(value);
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function sanitizedSort(value: string | string[] | undefined): ProductSort | undefined {
  const parsed = productSortSchema.safeParse(firstValue(value));
  return parsed.success ? parsed.data : undefined;
}

function sanitizedAvailability(
  value: string | string[] | undefined,
): ProductAvailability | undefined {
  const parsed = productAvailabilitySchema.safeParse(firstValue(value));
  return parsed.success ? parsed.data : undefined;
}

function sanitizedCondition(value: string | string[] | undefined): ConditionType | undefined {
  const raw = firstValue(value);
  return raw === ConditionType.NEW ||
    raw === ConditionType.REFURBISHED ||
    raw === ConditionType.OPEN_BOX
    ? raw
    : undefined;
}

/**
 * Turns a Next.js page's `searchParams` into `catalog/product.ts`'s
 * `ProductListInput`.
 *
 * JUDGMENT CALL: docs/07 §2 says an unrecognised filter key on the JSON
 * API is a hard `422` ("never silently ignored"). This is the HTML page
 * layer, not that API — refusing to render an entire category page
 * because of one stray or stale query parameter (a bookmarked link after
 * a filter was renamed, a browser extension appending a tracking param)
 * would be a worse experience than quietly dropping it. Every value below
 * is therefore sanitised against its own schema/whitelist and simply
 * omitted if invalid, rather than the whole page throwing. A future
 * JSON `/api/v1/products` route handler, if one gets built, should use
 * `productListInputSchema.parse` directly (letting it throw) to get the
 * stricter behaviour docs/07 actually specifies for that surface.
 */
export function parseStorefrontListParams(
  searchParams: StorefrontSearchParams,
  options: { categoryPath?: string; brandSlugs?: string[]; filterableSpecKeys: Set<string> },
): ProductListInput {
  const specFilters: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    if (!key.startsWith("spec.")) continue;
    const specKey = key.slice("spec.".length);
    if (!options.filterableSpecKeys.has(specKey)) continue;
    const values = allValues(value);
    // `specKey` was just checked against `options.filterableSpecKeys` above —
    // never an arbitrary attacker-controlled key by the time it reaches this assignment.
    // eslint-disable-next-line security/detect-object-injection
    if (values.length > 0) specFilters[specKey] = values;
  }

  const priceGteRupees = sanitizedNumber(searchParams.priceGte);
  const priceLteRupees = sanitizedNumber(searchParams.priceLte);
  const brandSlugs = options.brandSlugs?.length
    ? options.brandSlugs
    : allValues(searchParams.brand);

  return productListInputSchema.parse({
    categoryPath: options.categoryPath,
    brandSlugs: brandSlugs.length > 0 ? brandSlugs : undefined,
    availability: sanitizedAvailability(searchParams.availability),
    condition: sanitizedCondition(searchParams.condition),
    onSale: firstValue(searchParams.onSale) === "true" ? true : undefined,
    sort: sanitizedSort(searchParams.sort),
    page: sanitizedNumber(searchParams.page),
    priceGtePaisa: priceGteRupees != null ? rupeesToPaisa(Math.round(priceGteRupees)) : undefined,
    priceLtePaisa: priceLteRupees != null ? rupeesToPaisa(Math.round(priceLteRupees)) : undefined,
    specFilters: Object.keys(specFilters).length > 0 ? specFilters : undefined,
  });
}
