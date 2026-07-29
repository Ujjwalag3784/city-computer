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
import { getBrandBySlug } from "@/server/services/catalog/brand";
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

// See `/p/[productSlug]/page.tsx`'s identical constant/comment — no brand
// has a real Nepali translation yet.
const HAS_NE_TRANSLATION = false;

function hasNonPageParams(searchParams: StorefrontSearchParams): boolean {
  return Object.keys(searchParams).some((key) => key !== "page");
}

function currentPage(searchParams: StorefrontSearchParams): number {
  const raw = Array.isArray(searchParams.page) ? searchParams.page[0] : searchParams.page;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1;
}

/** `/b/[brandSlug]` — docs/07-API-DESIGN.md §3.1's `GET /api/v1/brands/{slug}` + `GET /api/v1/products?brand=...`, as one server-rendered page. */
interface BrandPageProps {
  params: Promise<{ locale: string; brandSlug: string }>;
  searchParams: Promise<StorefrontSearchParams>;
}

export async function generateMetadata({
  params,
  searchParams,
}: BrandPageProps): Promise<Metadata> {
  const { locale, brandSlug } = await params;
  const resolvedSearchParams = await searchParams;
  try {
    const brand = await getBrandBySlug(brandSlug, toPrismaLocale(locale));
    const pathname = `/b/${brandSlug}`;
    const page = currentPage(resolvedSearchParams);
    const title = paginatedTitle(brand.metaTitle ?? `${brand.name} — City Computer Systems`, page);
    const description = brand.metaDescription ?? undefined;
    const canonical = buildCanonical(pathname, locale, { page });
    const faceted = hasNonPageParams(resolvedSearchParams);

    return {
      title,
      description,
      alternates: {
        canonical,
        languages: buildHreflangAlternates(pathname, { ne: HAS_NE_TRANSLATION }),
      },
      robots: faceted
        ? ROBOTS_NOINDEX_FOLLOW
        : robotsForTranslationState(locale, HAS_NE_TRANSLATION),
      openGraph: buildOpenGraph({ title, description, url: canonical, locale }),
    };
  } catch {
    return {};
  }
}

export default async function BrandPage({ params, searchParams }: BrandPageProps) {
  const { locale, brandSlug } = await params;
  const resolvedSearchParams = await searchParams;
  const prismaLocale = toPrismaLocale(locale);

  let brand: Awaited<ReturnType<typeof getBrandBySlug>>;
  try {
    brand = await getBrandBySlug(brandSlug, prismaLocale);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  // No single category applies to a brand page — every filterable spec
  // key across every template is in play (`getFilterableSpecKeys()` with
  // no category id), same as `/products` with no `?category=` filter.
  const filterableSpecKeys = await getFilterableSpecKeys();
  const listInput = parseStorefrontListParams(resolvedSearchParams, {
    brandSlugs: [brand.slug],
    filterableSpecKeys,
  });
  const result = await listProducts(listInput, prismaLocale);

  const breadcrumbItems = [{ label: brand.name }];
  const pageUrl = absoluteUrl(`/b/${brandSlug}`, locale);
  const perPage = listInput.perPage ?? 24;
  const startPosition = (result.pagination.page - 1) * perPage + 1;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-4 sm:p-8">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex flex-col gap-2">
        <h1 className="text-headline-md text-on-surface">{brand.name}</h1>
        {brand.description && (
          <p className="max-w-[65ch] text-body-md text-on-surface-variant">{brand.description}</p>
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
          name: brand.name,
          description: brand.description ?? undefined,
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
