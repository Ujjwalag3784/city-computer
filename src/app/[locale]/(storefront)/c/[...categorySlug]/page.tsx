import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CatalogListing } from "@/components/commerce/catalog-listing";
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

export async function generateMetadata({ params }: CategoryPageProps): Promise<Metadata> {
  const { locale, categorySlug } = await params;
  try {
    const category = await getCategoryByPath(categorySlug.join("/"), toPrismaLocale(locale));
    return {
      title: category.metaTitle ?? `${category.name} — City Computer Systems`,
      description: category.metaDescription ?? undefined,
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

  const breadcrumbItems = trail.map((segment, index) => ({
    label: segment.name,
    href: index === trail.length - 1 ? undefined : `/c/${segment.path}`,
  }));

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
    </div>
  );
}
