import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CatalogListing } from "@/components/commerce/catalog-listing";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/jsonld/breadcrumb";
import { buildCollectionPageJsonLd, buildItemListJsonLd } from "@/lib/seo/jsonld/item-list";
import {
  buildCanonical,
  buildHreflangAlternates,
  buildOpenGraph,
  paginatedTitle,
  ROBOTS_NOINDEX_FOLLOW,
  robotsForTranslationState,
} from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { getCategoryBreadcrumbTrail, getCategoryByPath } from "@/server/services/catalog/category";
import { getFilterableSpecKeys } from "@/server/services/catalog/facet";
import { listProducts } from "@/server/services/catalog/product";
import { NotFoundError } from "@/lib/errors";
import {
  parseStorefrontListParams,
  toCatalogListingFacets,
  toCatalogListingPagination,
  toPrismaLocale,
  toProductCardData,
  type StorefrontSearchParams,
} from "../../_lib/catalog-view";

// See `/p/[productSlug]/page.tsx`'s identical constant/comment — no
// category has a real Nepali translation yet.
const HAS_NE_TRANSLATION = false;

/**
 * docs/11-SEO-STRATEGY.md §2.5's faceted-navigation table: only `page`
 * survives into the canonical URL; every other query param (sort, any
 * `spec.*`/`brand`/`priceGte`/`priceLte`/`availability`/`condition`
 * filter) canonicalises to the clean, unfiltered category URL and is
 * `noindex,follow` rather than self-canonical. This is deliberately a
 * blanket rule (no per-facet whitelist of "canonical combinations" yet —
 * docs/11 §2.5's `CategoryFacetLanding` whitelist doesn't exist in this
 * schema, see PROGRESS.md Phase 11) — safer to under-index than to index
 * an unbounded number of filter combinations.
 */
function hasNonPageParams(searchParams: StorefrontSearchParams): boolean {
  return Object.keys(searchParams).some((key) => key !== "page");
}

function currentPage(searchParams: StorefrontSearchParams): number {
  const raw = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1;
}

/**
 * `/c/[...categorySlug]` — docs/07-API-DESIGN.md §3.1's `GET
 * /api/v1/categories/{path}` + `GET /api/v1/products?category=...`,
 * rendered as one server-rendered page (docs/07 §1: RSC data loading,
 * "no HTTP hop" — this page calls the catalog service layer directly,
 * it doesn't fetch its own API).
 *
 * The catch-all `[...categorySlug]` segment array is joined back into the
 * materialised `path` (`["laptops","gaming"]` → `"laptops/gaming"`) that
 * `Category.path` actually stores — see `catalog/category.ts`'s own
 * comment on why that column exists at all.
 */
interface CategoryPageProps {
  params: Promise<{ locale: string; categorySlug: string[] }>;
  searchParams: Promise<StorefrontSearchParams>;
}

export async function generateMetadata({
  params,
  searchParams,
}: CategoryPageProps): Promise<Metadata> {
  const { locale, categorySlug } = await params;
  const resolvedSearchParams = await searchParams;
  try {
    const category = await getCategoryByPath(categorySlug.join("/"), toPrismaLocale(locale));
    const pathname = `/c/${categorySlug.join("/")}`;
    const page = currentPage(resolvedSearchParams);
    const baseTitle = category.metaTitle ?? `${category.name} — City Computer Systems`;
    const baseDescription = category.metaDescription ?? undefined;
    const title = paginatedTitle(baseTitle, page);
    // `paginatedDescription` also wants the total page count, which would
    // need a second products query just for metadata — not worth it here;
    // the paginated title alone already keeps page 2+ SERP entries from
    // being literal duplicates (docs/11 §6.6's stated purpose).
    const description = baseDescription;
    const canonical = buildCanonical(pathname, locale, { page });
    const faceted = hasNonPageParams(resolvedSearchParams);

    return {
      title,
      description,
      alternates: {
        canonical,
        languages: buildHreflangAlternates(pathname, { ne: HAS_NE_TRANSLATION }),
      },
      // A filtered/sorted view (anything beyond `?page=`) is crawlable but
      // never indexable and always canonicalises up to the clean URL —
      // docs/11 §2.5. Otherwise, the usual ne-translation-state gate.
      robots: faceted
        ? ROBOTS_NOINDEX_FOLLOW
        : robotsForTranslationState(locale, HAS_NE_TRANSLATION),
      openGraph: buildOpenGraph({ title, description, url: canonical, locale }),
    };
  } catch {
    // A missing category 404s via `notFound()` in the page component
    // itself, below — metadata generation just quietly returns nothing
    // rather than duplicating that error handling.
    return {};
  }
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { locale, categorySlug } = await params;
  const resolvedSearchParams = await searchParams;
  const prismaLocale = toPrismaLocale(locale);
  const categoryPath = categorySlug.join("/");

  let category: Awaited<ReturnType<typeof getCategoryByPath>>;
  try {
    category = await getCategoryByPath(categoryPath, prismaLocale);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [trail, filterableSpecKeys] = await Promise.all([
    getCategoryBreadcrumbTrail(categoryPath, prismaLocale),
    getFilterableSpecKeys(category.id),
  ]);

  const listInput = parseStorefrontListParams(resolvedSearchParams, {
    categoryPath,
    filterableSpecKeys,
  });
  const result = await listProducts(listInput, prismaLocale);

  // Single source of truth for the visible trail and the BreadcrumbList
  // JSON-LD below.
  const breadcrumbItems = trail.map((segment, index) => ({
    label: segment.name,
    href: index === trail.length - 1 ? undefined : `/c/${segment.path}`,
  }));
  const pageUrl = absoluteUrl(`/c/${categoryPath}`, locale);
  const perPage = listInput.perPage ?? 24;
  const startPosition = (result.pagination.page - 1) * perPage + 1;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-4 sm:p-8">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex flex-col gap-2">
        <h1 className="text-headline-md text-on-surface">{category.name}</h1>
        {category.description && (
          <p className="max-w-[65ch] text-body-md text-on-surface-variant">
            {category.description}
          </p>
        )}
      </div>
      <CatalogListing
        products={result.items.map(toProductCardData)}
        facets={toCatalogListingFacets(result.facets)}
        pagination={toCatalogListingPagination(result.pagination)}
      />

      <JsonLd data={buildBreadcrumbListJsonLd(breadcrumbItems, locale, { pageUrl })} />
      <JsonLd
        data={buildCollectionPageJsonLd({
          locale,
          pageUrl,
          name: category.name,
          description: category.description ?? undefined,
        })}
      />
      <JsonLd
        data={buildItemListJsonLd({
          locale,
          pageUrl,
          items: result.items.map((item) => ({ href: `/p/${item.slug}`, name: item.displayTitle })),
          startPosition,
          numberOfItems: result.pagination.total,
        })}
      />
    </div>
  );
}
