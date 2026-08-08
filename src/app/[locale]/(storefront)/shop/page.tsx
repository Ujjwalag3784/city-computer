import type { Metadata } from "next";
import { CatalogListing } from "@/components/commerce/catalog-listing";
import { JsonLd } from "@/components/seo/json-ld";
import { buildCollectionPageJsonLd, buildItemListJsonLd } from "@/lib/seo/jsonld/item-list";
import {
  buildCanonical,
  paginatedTitle,
  ROBOTS_NOINDEX_FOLLOW,
  robotsForTranslationState,
} from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { getFilterableSpecKeys } from "@/server/services/catalog/facet";
import { listProducts } from "@/server/services/catalog/product";
import {
  parseStorefrontListParams,
  toCatalogListingFacets,
  toCatalogListingPagination,
  toPrismaLocale,
  toProductCardData,
  type StorefrontSearchParams,
} from "../_lib/catalog-view";

// No Nepali copy exists for this page yet — same posture as `/c/[...]` and
// `/p/[productSlug]`.
const HAS_NE_TRANSLATION = false;

/**
 * `/shop` — the one general "every product" listing this app didn't have.
 * Every category page (`/c/[...categorySlug]`) requires a category; there
 * was no unfiltered entry point at all, so `SiteFooter`'s and
 * `MobileNav`'s existing "Deals" link (`/shop?sort=discount`) and the
 * homepage's new "New Arrivals"/"Sale Items" rails all pointed at nothing
 * — a second, independent instance of the same "the button, not the page,
 * was ever built" bug class as the homepage's PC Builder CTA.
 *
 * Built as a thin wrapper around the same `CatalogListing` engine the
 * category page already uses, with `categoryPath` simply omitted —
 * `parseStorefrontListParams`'s `categoryPath` option and
 * `getFilterableSpecKeys`'s `categoryId` parameter are both already
 * optional for exactly this shape, so no changes to either were needed.
 *
 * The heading adapts to `sort`/`onSale` so the same route serves "New
 * Arrivals", "Sale Items" and a plain "Shop" without three near-duplicate
 * page files — deliberately not three separate routes, since the only
 * difference between them is which query params are pre-set on the link
 * that got here.
 */
interface ShopPageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<StorefrontSearchParams>;
}

function firstOf(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/** Same "only `page` survives into the canonical/indexable URL" rule as `/c/[...categorySlug]` (docs/11 §2.5) — any other param is a valid, crawlable, noindexed view. */
function hasNonPageParams(searchParams: StorefrontSearchParams): boolean {
  return Object.keys(searchParams).some((key) => key !== "page");
}

function currentPage(searchParams: StorefrontSearchParams): number {
  const raw = firstOf(searchParams.page);
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 1 ? parsed : 1;
}

function headingFor(searchParams: StorefrontSearchParams): { title: string; description: string } {
  if (firstOf(searchParams.onSale) === "true") {
    return {
      title: "Sale items",
      description: "Every product currently marked down from its regular price.",
    };
  }
  if (firstOf(searchParams.sort) === "-createdAt") {
    return { title: "New arrivals", description: "The newest products added to the catalogue." };
  }
  return { title: "Shop", description: "Browse the full catalogue." };
}

export async function generateMetadata({ searchParams }: ShopPageProps): Promise<Metadata> {
  const resolved = await searchParams;
  const page = currentPage(resolved);
  const { title: heading } = headingFor(resolved);
  const title = paginatedTitle(`${heading} — City Computer Systems`, page);
  const canonical = buildCanonical("/shop", "en", { page });
  const faceted = hasNonPageParams(resolved);

  return {
    title,
    alternates: { canonical },
    robots: faceted ? ROBOTS_NOINDEX_FOLLOW : robotsForTranslationState("en", HAS_NE_TRANSLATION),
  };
}

export default async function ShopPage({ params, searchParams }: ShopPageProps) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const prismaLocale = toPrismaLocale(locale);
  const { title, description } = headingFor(resolvedSearchParams);

  const filterableSpecKeys = await getFilterableSpecKeys();
  const listInput = parseStorefrontListParams(resolvedSearchParams, { filterableSpecKeys });
  const result = await listProducts(listInput, prismaLocale);

  const pageUrl = absoluteUrl("/shop", locale);
  const perPage = listInput.perPage ?? 24;
  const startPosition = (result.pagination.page - 1) * perPage + 1;

  return (
    <div className="mx-auto flex max-w-[1280px] flex-col gap-6 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-headline-md text-on-surface">{title}</h1>
        <p className="max-w-[65ch] text-body-md text-on-surface-variant">{description}</p>
      </div>
      <CatalogListing
        products={result.items.map(toProductCardData)}
        facets={toCatalogListingFacets(result.facets)}
        pagination={toCatalogListingPagination(result.pagination)}
      />

      <JsonLd data={buildCollectionPageJsonLd({ locale, pageUrl, name: title, description })} />
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
