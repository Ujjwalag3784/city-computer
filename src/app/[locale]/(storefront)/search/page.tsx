import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { LISTING_PAGE_CLASS, ListingHeader } from "@/components/commerce/listing-header";
import { SearchForm } from "@/components/layout/search-form";
import { CatalogListing } from "@/components/commerce/catalog-listing";
import { ROBOTS_NOINDEX_FOLLOW } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
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
  return {
    title: query ? t("resultsFor", { query }) : "Search — City Computer Systems",
    // docs/11-SEO-STRATEGY.md §2.5/§5.5: search results "carry no unique
    // value" — noindexed at the HTML level (and disallowed separately in
    // robots.txt). Still self-canonical, per the acceptance bar's "every
    // route type emits a correct, self-referencing canonical" — a
    // noindexed page still needs one so it never accidentally canonicalises
    // to (or gets treated as a duplicate of) some other URL.
    alternates: { canonical: absoluteUrl("/search", locale) },
    robots: ROBOTS_NOINDEX_FOLLOW,
  };
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
      <div className={LISTING_PAGE_CLASS}>
        <ListingHeader eyebrow="Search" title={tc("searchPlaceholder")} />
        <SearchForm id="search-page" className="max-w-xl" />
      </div>
    );
  }

  const rawPage = firstValue(resolved.page);
  const result = await searchProducts(
    { q: query, page: rawPage ? Number(rawPage) : undefined },
    prismaLocale,
  );

  return (
    <div className={LISTING_PAGE_CLASS}>
      <ListingHeader
        eyebrow="Search"
        title={t("resultsFor", { query: result.query })}
        description={result.items.length === 0 ? t("zeroResultsHint") : undefined}
        stats={[{ label: "Matches", value: result.pagination.total.toLocaleString("en-US") }]}
      />
      <CatalogListing
        products={result.items.map(toProductCardData)}
        facets={{ brands: [], specs: [], priceRangePaisa: null }}
        pagination={toCatalogListingPagination(result.pagination)}
        enableSort={false}
      />
    </div>
  );
}
