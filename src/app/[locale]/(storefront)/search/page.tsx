import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { CatalogListing } from "@/components/commerce/catalog-listing";
import { searchProducts } from "@/server/services/catalog/search";
import {
  firstValue,
  toCatalogListingPagination,
  toPrismaLocale,
  toProductCardData,
  type StorefrontSearchParams,
} from "../_lib/catalog-view";

/**
 * `/search` — docs/07-API-DESIGN.md §3.1's `GET /api/v1/search?q=`.
 *
 * No facets (`catalog/search.ts` doesn't build any — full-text search
 * ranks by relevance, it doesn't offer a category/brand/spec breakdown of
 * its own result set in this pass) and no sort control (`enableSort=false`
 * — search results only have one order, ranked relevance; there is no
 * `sort` parameter for `searchProducts` to apply).
 */
interface SearchPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<StorefrontSearchParams>;
}

export async function generateMetadata({
  params,
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const { locale } = await params;
  const resolved = await searchParams;
  const query = firstValue(resolved.q)?.trim();
  const t = await getTranslations({ locale, namespace: "search" });
  return { title: query ? t("resultsFor", { query }) : "Search — City Computer Systems" };
}

export default async function SearchPage({ params, searchParams }: SearchPageProps) {
  const { locale } = await params;
  const resolved = await searchParams;
  const prismaLocale = toPrismaLocale(locale);
  const t = await getTranslations("search");
  const tc = await getTranslations("common");

  const query = firstValue(resolved.q)?.trim();

  if (!query) {
    return (
      <div className="mx-auto flex max-w-[1280px] flex-col items-center gap-3 p-8 py-24 text-center">
        <p className="text-headline-sm text-on-surface">{tc("searchPlaceholder")}</p>
      </div>
    );
  }

  const rawPage = firstValue(resolved.page);
  const result = await searchProducts(
    { q: query, page: rawPage ? Number(rawPage) : undefined },
    prismaLocale,
  );

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-headline-md text-on-surface">
          {t("resultsFor", { query: result.query })}
        </h1>
        {result.items.length === 0 && (
          <p className="text-body-md text-on-surface-variant">{t("zeroResultsHint")}</p>
        )}
      </div>
      <CatalogListing
        products={result.items.map(toProductCardData)}
        facets={{ brands: [], specs: [], priceRangePaisa: null }}
        pagination={toCatalogListingPagination(result.pagination)}
        enableSort={false}
      />
    </div>
  );
}
