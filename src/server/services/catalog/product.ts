/**
 * Product read path — docs/06-DATA-MODEL.md §4, docs/07-API-DESIGN.md
 * §3.1 (`GET /api/v1/products`, `GET /api/v1/products/{slug}`) including
 * the exact "Product summary shape (list)" JSON docs/07 §3.1 specifies.
 *
 * Price and availability both live on `Variant`, not `Product` (docs/06
 * §4: "The unit that is actually priced, stocked, and sold. **Every
 * product has at least one variant**"), so every summary/detail mapper
 * here resolves "the cheapest active variant" per product rather than
 * reading a price off Product directly — there is no such field.
 */
import "server-only";
import { db } from "@/server/db";
import {
  Locale,
  ProductStatus,
  type ConditionType,
  type MediaRole,
  type Prisma,
  type ProductType,
} from "@/generated/prisma/client";
import { discountPercent } from "@/lib/money";
import { NotFoundError, validationErrorFromZodIssues } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { productListInputSchema, type ProductSort } from "@/lib/validation/catalog";
import { resolveTranslated, buildPaginationMeta, type PaginationMeta } from "./locale-helpers";
import { getCategoryDescendantIdsByPath } from "./category";
import { buildCatalogFacets, type CatalogFacets } from "./facet";

// ---------------------------------------------------------------------------
// Shapes
// ---------------------------------------------------------------------------

export interface ProductImageRef {
  url: string;
  blurDataUrl: string | null;
  alt: string;
}

/** docs/07 §3.1's exact list shape. */
export interface ProductSummary {
  id: string;
  slug: string;
  /**
   * The cheapest active variant's id — the same row `priceFrom` is derived
   * from, so a card's quick-add adds exactly the item whose price it
   * displays. `null` only for the malformed "product with no active
   * variant" case flagged in `toProductSummary` below.
   */
  defaultVariantId: string | null;
  displayTitle: string;
  brand: { slug: string; name: string };
  primaryCategory: { slug: string; name: string };
  image: ProductImageRef | null;
  specHighlights: { label: string; value: string }[];
  priceFrom: { amountPaisa: number; compareAtPaisa: number | null; discountPercent: number | null };
  availability: "IN_STOCK" | "OUT_OF_STOCK";
  rating: { average: number | null; count: number };
  badges: string[];
}

export interface ProductVariantDetail {
  id: string;
  sku: string;
  title: string | null;
  pricePaisa: number;
  compareAtPricePaisa: number | null;
  isDefault: boolean;
  isActive: boolean;
  allowBackorder: boolean;
  optionValues: { optionType: string; value: string }[];
  availableQuantity: number;
}

export interface ProductSpecRow {
  key: string;
  label: string;
  value: string;
  unit: string | null;
  group: string | null;
}

/** docs/07 §3.1: "Product detail: Includes variants, media, specs, stock summary, related." */
export interface ProductDetail {
  id: string;
  slug: string;
  name: string;
  displayTitle: string;
  h1: string;
  shortDescription: string;
  /** Tiptap JSON — rendering is a client-component concern (docs/04's `components/content/RichText`), not this service's. */
  description: Prisma.JsonValue;
  brand: { slug: string; name: string };
  /** `path` (not just `slug`) so the PDP breadcrumb can link straight to `/c/${path}` even for a nested category — `slug` alone (e.g. `"gaming"`) isn't a resolvable path for anything below the top level. */
  primaryCategory: { slug: string; path: string; name: string };
  type: ProductType;
  conditionType: ConditionType;
  warrantyMonths: number | null;
  warrantyText: string | null;
  media: { url: string; blurDataUrl: string | null; alt: string; role: MediaRole }[];
  variants: ProductVariantDetail[];
  specs: ProductSpecRow[];
  rating: { average: number | null; count: number };
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalOverride: string | null;
  relatedProducts: ProductSummary[];
}

export interface ListProductsResult {
  items: ProductSummary[];
  pagination: PaginationMeta;
  facets: CatalogFacets;
}

// ---------------------------------------------------------------------------
// Shared include shapes + row → summary mapping
// ---------------------------------------------------------------------------

const PRODUCT_SUMMARY_INCLUDE = {
  brand: { select: { slug: true, name: true } },
  primaryCategory: { select: { slug: true, translations: true } },
  media: {
    orderBy: { position: "asc" },
    take: 5,
    include: { media: true },
  },
  specs: {
    where: { isFilterable: true },
    orderBy: { position: "asc" },
    take: 3,
  },
} satisfies Prisma.ProductInclude;

type ProductForSummary = Prisma.ProductGetPayload<{ include: typeof PRODUCT_SUMMARY_INCLUDE }>;

interface MinPriceVariantRow {
  id: string;
  productId: string;
  pricePaisa: number;
  compareAtPricePaisa: number | null;
  stockLevels: { quantity: number }[];
}

/**
 * The cheapest active variant per product, in one query — `distinct` +
 * `orderBy` ordered `[productId, pricePaisa]` reliably returns the
 * lowest-price row per product (a standard, documented Prisma pattern for
 * "first row per group"), rather than independently-aggregated mins that
 * could stitch together price and compareAt from two different rows.
 */
async function getMinPriceVariantsByProduct(
  productIds: string[],
): Promise<Map<string, MinPriceVariantRow>> {
  if (productIds.length === 0) return new Map();
  const rows = await db.variant.findMany({
    where: { productId: { in: productIds }, isActive: true },
    orderBy: [{ productId: "asc" }, { pricePaisa: "asc" }],
    distinct: ["productId"],
    select: {
      id: true,
      productId: true,
      pricePaisa: true,
      compareAtPricePaisa: true,
      stockLevels: { select: { quantity: true } },
    },
  });
  return new Map(rows.map((row) => [row.productId, row]));
}

function formatSpecValue(spec: {
  valueText: string | null;
  valueNumber: Prisma.Decimal | null;
  valueBool: boolean | null;
  unit: string | null;
}): string {
  if (spec.valueText != null) return spec.valueText;
  if (spec.valueNumber != null) {
    const numeric = spec.valueNumber.toNumber();
    return spec.unit ? `${numeric} ${spec.unit}` : String(numeric);
  }
  if (spec.valueBool != null) return spec.valueBool ? "Yes" : "No";
  return "";
}

function pickCardImage(
  media: ProductForSummary["media"],
  fallbackAlt: string,
): ProductImageRef | null {
  const thumbnail = media.find((entry) => entry.role === "THUMBNAIL");
  const gallery = media.find((entry) => entry.role === "GALLERY");
  const chosen = thumbnail ?? gallery ?? media[0];
  if (!chosen) return null;
  return {
    url: chosen.media.cdnUrl ?? chosen.media.url,
    blurDataUrl: chosen.media.blurDataUrl,
    alt: chosen.media.altText ?? fallbackAlt,
  };
}

/**
 * docs/06 §4: "`ratingCount = 0` MUST suppress rating schema" — enforced
 * here at the mapping boundary (not trusted from the stored
 * `ratingAverage` value alone) so every caller of this service
 * automatically gets a `null` average whenever there are zero ratings,
 * regardless of whether the denormalisation job that maintains
 * `Product.ratingAverage` has run.
 */
function toRating(
  ratingAverage: Prisma.Decimal | null,
  ratingCount: number,
): {
  average: number | null;
  count: number;
} {
  return {
    average: ratingCount > 0 ? (ratingAverage?.toNumber() ?? null) : null,
    count: ratingCount,
  };
}

function toProductSummary(
  product: ProductForSummary,
  locale: Locale,
  minPriceVariant: MinPriceVariantRow | undefined,
): ProductSummary {
  if (!minPriceVariant) {
    // docs/06 §4: "Every product has at least one variant" — this should
    // be unreachable in well-formed data. Surfaced as a zero-priced,
    // out-of-stock entry rather than thrown, so one malformed product
    // can't 500 an entire category page; loud in logs so it gets fixed.
    logger.warn({ productId: product.id }, "toProductSummary: product has no active variant");
  }

  const categoryName = resolveTranslated(
    product.primaryCategory.translations,
    locale,
    "name",
    product.primaryCategory.slug,
  );

  const availableQuantity = minPriceVariant
    ? minPriceVariant.stockLevels.reduce((sum, level) => sum + level.quantity, 0)
    : 0;

  return {
    id: product.id,
    slug: product.slug,
    defaultVariantId: minPriceVariant?.id ?? null,
    displayTitle: product.displayTitle,
    brand: { slug: product.brand.slug, name: product.brand.name },
    primaryCategory: { slug: product.primaryCategory.slug, name: categoryName },
    image: pickCardImage(product.media, product.displayTitle),
    specHighlights: product.specs.map((spec) => ({
      label: spec.label,
      value: formatSpecValue(spec),
    })),
    priceFrom: {
      amountPaisa: minPriceVariant?.pricePaisa ?? 0,
      compareAtPaisa: minPriceVariant?.compareAtPricePaisa ?? null,
      discountPercent: minPriceVariant
        ? discountPercent(minPriceVariant.pricePaisa, minPriceVariant.compareAtPricePaisa)
        : null,
    },
    availability: availableQuantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
    rating: toRating(product.ratingAverage, product.ratingCount),
    badges: [...(product.isNew ? ["NEW"] : []), ...(product.isFeatured ? ["FEATURED"] : [])],
  };
}

// ---------------------------------------------------------------------------
// listProducts
// ---------------------------------------------------------------------------

interface ProductSortMeta {
  createdAt: Date;
  isFeatured: boolean;
  publishedAt: Date | null;
}

function sortProductIds(
  ids: string[],
  sort: ProductSort,
  metaById: Map<string, ProductSortMeta>,
  minPriceVariants: Map<string, MinPriceVariantRow>,
): string[] {
  const priceOf = (id: string) => minPriceVariants.get(id)?.pricePaisa ?? Number.POSITIVE_INFINITY;
  const discountOf = (id: string) => {
    const variant = minPriceVariants.get(id);
    if (!variant) return -1;
    return discountPercent(variant.pricePaisa, variant.compareAtPricePaisa) ?? -1;
  };
  const createdAtOf = (id: string) => metaById.get(id)?.createdAt.getTime() ?? 0;

  switch (sort) {
    case "price":
      return [...ids].sort((a, b) => priceOf(a) - priceOf(b));
    case "-price":
      return [...ids].sort((a, b) => priceOf(b) - priceOf(a));
    case "-discount":
      return [...ids].sort((a, b) => discountOf(b) - discountOf(a));
    case "-sales":
      // Sales-velocity ranking needs the `product_sales_30d` materialised
      // view docs/06 §11 describes — no rollup job exists in this
      // codebase yet. Falls back to newest-first rather than pretending
      // to rank by sales; flagged, not faked.
      return [...ids].sort((a, b) => createdAtOf(b) - createdAtOf(a));
    case "-createdAt":
      return [...ids].sort((a, b) => createdAtOf(b) - createdAtOf(a));
    case "relevance":
    default:
      // No search query in `listProducts` (that's `search.ts`'s job), so
      // "relevance" here means a merchandising default: featured first,
      // then newest-published.
      return [...ids].sort((a, b) => {
        const metaA = metaById.get(a);
        const metaB = metaById.get(b);
        const featuredDiff =
          Number(metaB?.isFeatured ?? false) - Number(metaA?.isFeatured ?? false);
        if (featuredDiff !== 0) return featuredDiff;
        return (metaB?.publishedAt?.getTime() ?? 0) - (metaA?.publishedAt?.getTime() ?? 0);
      });
  }
}

/**
 * docs/07 §3.1's `GET /api/v1/products` — filter, sort, paginate, and
 * return facet counts for the matched set in one call.
 *
 * JUDGMENT CALL (scale): resolves the *entire* matching id set (plus a
 * handful of scalar sort fields) before sorting/paginating in JS, rather
 * than pushing `ORDER BY`/`LIMIT`/`OFFSET` down into SQL. Correct for a
 * single-retailer catalogue (docs/06 §13.3 seeds 20 dev products; a real
 * deployment here is not big-tech scale) and it keeps one code path for
 * every sort option instead of a SQL path for "-createdAt" and a
 * different JS path for "-price"/"-discount" (which need a per-product
 * variant aggregate SQL cannot express declaratively via Prisma's
 * `orderBy`). If the catalogue outgrows this, the fix is a denormalised
 * `Product.minPricePaisa` column (maintained the same way
 * `Customer.totalOrders` already is, per docs/06 §3) so price sort can
 * move back into SQL — not a rewrite of this function's shape.
 */
export async function listProducts(
  input: unknown,
  locale: Locale = Locale.EN,
): Promise<ListProductsResult> {
  const parsed = productListInputSchema.safeParse(input);
  if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
  const params = parsed.data;

  const categoryIds = params.categoryPath
    ? await getCategoryDescendantIdsByPath(params.categoryPath)
    : null;

  const andConditions: Prisma.ProductWhereInput[] = [];

  if (categoryIds) {
    andConditions.push({ categories: { some: { categoryId: { in: categoryIds } } } });
  }
  if (params.brandSlugs?.length) {
    andConditions.push({ brand: { slug: { in: params.brandSlugs } } });
  }
  if (params.condition) {
    andConditions.push({ conditionType: params.condition });
  }
  if (params.q) {
    // Basic substring matching for the `/products?q=` filter parameter —
    // NOT the ranked full-text search behind docs/07's dedicated
    // `GET /api/v1/search?q=` endpoint (see `catalog/search.ts`). Kept
    // deliberately simple here since this is a *filter on top of* a
    // browse listing, not the primary search surface.
    andConditions.push({
      OR: [
        { displayTitle: { contains: params.q, mode: "insensitive" } },
        { name: { contains: params.q, mode: "insensitive" } },
      ],
    });
  }
  if (params.priceGtePaisa != null || params.priceLtePaisa != null) {
    andConditions.push({
      variants: {
        some: {
          isActive: true,
          pricePaisa: {
            ...(params.priceGtePaisa != null ? { gte: params.priceGtePaisa } : {}),
            ...(params.priceLtePaisa != null ? { lte: params.priceLtePaisa } : {}),
          },
        },
      },
    });
  }
  if (params.onSale) {
    andConditions.push({
      variants: { some: { isActive: true, compareAtPricePaisa: { not: null } } },
    });
  }
  if (params.availability === "in_stock") {
    // JUDGMENT CALL: "in stock" is approximated here as "has on-hand
    // quantity > 0", not the authoritative `quantity - reservedQuantity`
    // formula docs/06 §5 defines for cart/checkout — comparing two
    // columns of the same row isn't expressible in Prisma's declarative
    // `where` without raw SQL, and reservations are small relative to
    // on-hand stock for browse-time filtering. The authoritative formula
    // is still enforced where it actually matters: `inventory/`'s
    // reservation logic at add-to-cart and checkout.
    andConditions.push({
      variants: {
        some: {
          isActive: true,
          stockLevels: {
            some: {
              quantity: { gt: 0 },
              ...(params.branchSlug ? { branch: { slug: params.branchSlug } } : {}),
            },
          },
        },
      },
    });
  } else if (params.availability === "out_of_stock") {
    andConditions.push({
      variants: {
        every: { OR: [{ isActive: false }, { stockLevels: { none: { quantity: { gt: 0 } } } }] },
      },
    });
  }
  if (params.specFilters) {
    for (const [key, values] of Object.entries(params.specFilters)) {
      andConditions.push({ specs: { some: { key, valueText: { in: values } } } });
    }
  }
  if (params.specRangeFilters) {
    for (const [key, range] of Object.entries(params.specRangeFilters)) {
      andConditions.push({
        specs: {
          some: {
            key,
            valueNumber: {
              ...(range.gte != null ? { gte: range.gte } : {}),
              ...(range.lte != null ? { lte: range.lte } : {}),
            },
          },
        },
      });
    }
  }

  const where: Prisma.ProductWhereInput = {
    status: ProductStatus.ACTIVE,
    ...(andConditions.length ? { AND: andConditions } : {}),
  };

  const matched = await db.product.findMany({
    where,
    select: { id: true, createdAt: true, isFeatured: true, publishedAt: true },
  });
  const matchedIds = matched.map((row) => row.id);
  const metaById = new Map(matched.map((row) => [row.id, row]));
  const total = matchedIds.length;

  const [facets, minPriceVariants] = await Promise.all([
    buildCatalogFacets(matchedIds),
    getMinPriceVariantsByProduct(matchedIds),
  ]);

  const sortedIds = sortProductIds(matchedIds, params.sort, metaById, minPriceVariants);
  const pageIds = sortedIds.slice((params.page - 1) * params.perPage, params.page * params.perPage);

  const products = pageIds.length
    ? await db.product.findMany({
        where: { id: { in: pageIds } },
        include: PRODUCT_SUMMARY_INCLUDE,
      })
    : [];
  const productsById = new Map(products.map((product) => [product.id, product]));

  const items = pageIds
    .map((id) => productsById.get(id))
    .filter((product): product is ProductForSummary => product !== undefined)
    .map((product) => toProductSummary(product, locale, minPriceVariants.get(product.id)));

  return { items, pagination: buildPaginationMeta(params.page, params.perPage, total), facets };
}

/**
 * Bulk summary hydration preserving the caller's id order — used by
 * `catalog/search.ts` to turn a ranked list of product ids from a raw SQL
 * query back into full `ProductSummary` objects without losing the rank
 * order (Prisma's `findMany({ where: { id: { in } } })` does not
 * guarantee result order matches the `in` list).
 */
export async function getProductSummariesByIds(
  ids: string[],
  locale: Locale = Locale.EN,
): Promise<ProductSummary[]> {
  if (ids.length === 0) return [];

  const [products, minPriceVariants] = await Promise.all([
    db.product.findMany({ where: { id: { in: ids } }, include: PRODUCT_SUMMARY_INCLUDE }),
    getMinPriceVariantsByProduct(ids),
  ]);
  const productsById = new Map(products.map((product) => [product.id, product]));

  return ids
    .map((id) => productsById.get(id))
    .filter((product): product is ProductForSummary => product !== undefined)
    .map((product) => toProductSummary(product, locale, minPriceVariants.get(product.id)));
}

// ---------------------------------------------------------------------------
// getProductBySlug
// ---------------------------------------------------------------------------

const PRODUCT_DETAIL_INCLUDE = {
  brand: { select: { slug: true, name: true } },
  primaryCategory: { select: { slug: true, path: true, translations: true } },
  media: {
    orderBy: { position: "asc" },
    include: { media: true },
  },
  specs: { orderBy: [{ group: "asc" }, { position: "asc" }] },
  variants: {
    where: { isActive: true },
    orderBy: { position: "asc" },
    include: {
      optionValues: { include: { optionValue: { include: { optionType: true } } } },
      stockLevels: { select: { quantity: true } },
    },
  },
  relatedFrom: {
    orderBy: { position: "asc" },
    include: {
      relatedProduct: { include: PRODUCT_SUMMARY_INCLUDE },
    },
  },
} satisfies Prisma.ProductInclude;

type ProductForDetail = Prisma.ProductGetPayload<{ include: typeof PRODUCT_DETAIL_INCLUDE }>;

function toVariantDetail(variant: ProductForDetail["variants"][number]): ProductVariantDetail {
  return {
    id: variant.id,
    sku: variant.sku,
    title: variant.title,
    pricePaisa: variant.pricePaisa,
    compareAtPricePaisa: variant.compareAtPricePaisa,
    isDefault: variant.isDefault,
    isActive: variant.isActive,
    allowBackorder: variant.allowBackorder,
    optionValues: variant.optionValues.map((entry) => ({
      optionType: entry.optionValue.optionType.name,
      value: entry.optionValue.value,
    })),
    availableQuantity: variant.stockLevels.reduce((sum, level) => sum + level.quantity, 0),
  };
}

export async function getProductBySlug(
  slug: string,
  locale: Locale = Locale.EN,
): Promise<ProductDetail> {
  const product = await db.product.findFirst({
    where: { slug, status: ProductStatus.ACTIVE },
    include: PRODUCT_DETAIL_INCLUDE,
  });
  if (!product) throw new NotFoundError("Product");

  const categoryName = resolveTranslated(
    product.primaryCategory.translations,
    locale,
    "name",
    product.primaryCategory.slug,
  );

  const relatedProductIds = product.relatedFrom.map((entry) => entry.relatedProduct.id);
  const relatedMinPriceVariants = await getMinPriceVariantsByProduct(relatedProductIds);

  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    displayTitle: product.displayTitle,
    h1: product.h1,
    shortDescription: product.shortDescription,
    description: product.description,
    brand: { slug: product.brand.slug, name: product.brand.name },
    primaryCategory: {
      slug: product.primaryCategory.slug,
      path: product.primaryCategory.path,
      name: categoryName,
    },
    type: product.type,
    conditionType: product.conditionType,
    warrantyMonths: product.warrantyMonths,
    warrantyText: product.warrantyText,
    media: product.media.map((entry) => ({
      url: entry.media.cdnUrl ?? entry.media.url,
      blurDataUrl: entry.media.blurDataUrl,
      alt: entry.media.altText ?? product.displayTitle,
      role: entry.role,
    })),
    variants: product.variants.map(toVariantDetail),
    specs: product.specs.map((spec) => ({
      key: spec.key,
      label: spec.label,
      value: formatSpecValue(spec),
      unit: spec.unit,
      group: spec.group,
    })),
    rating: toRating(product.ratingAverage, product.ratingCount),
    metaTitle: product.metaTitle,
    metaDescription: product.metaDescription,
    canonicalOverride: product.canonicalOverride,
    // `relatedFrom` is the manually-curated side (docs/06 §4's
    // `RelatedProduct`) only — the "nightly job that proposes suggestions"
    // the doc also mentions is not built (no job runner wired up yet,
    // per PROGRESS.md); every related product shown today was chosen by
    // an admin, not inferred.
    relatedProducts: product.relatedFrom.map((entry) =>
      toProductSummary(
        entry.relatedProduct,
        locale,
        relatedMinPriceVariants.get(entry.relatedProduct.id),
      ),
    ),
  };
}
