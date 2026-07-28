import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CatalogListing } from "@/components/commerce/catalog-listing";
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

/** `/b/[brandSlug]` — docs/07-API-DESIGN.md §3.1's `GET /api/v1/brands/{slug}` + `GET /api/v1/products?brand=...`, as one server-rendered page. */
interface BrandPageProps {
  params: Promise<{ locale: string; brandSlug: string }>;
  searchParams: Promise<StorefrontSearchParams>;
}

export async function generateMetadata({ params }: BrandPageProps): Promise<Metadata> {
  const { locale, brandSlug } = await params;
  try {
    const brand = await getBrandBySlug(brandSlug, toPrismaLocale(locale));
    return {
      title: brand.metaTitle ?? `${brand.name} — City Computer Systems`,
      description: brand.metaDescription ?? undefined,
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

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-4 sm:p-8">
      <Breadcrumbs items={[{ label: brand.name }]} />
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
    </div>
  );
}
