"use client";

/**
 * CatalogListing — the interactive shell around `ProductGrid` for every
 * page that lists products with filters/sort/pagination (docs/05
 * §8's Category/Shop page layout: "lg: [288px sticky filter rail ‖ 3-col
 * grid] / <lg: [filter button → sheet, 2-col grid]"). Used by the category
 * (`/c/[...categorySlug]`), brand (`/b/[brandSlug]`), and search
 * (`/search`) pages — three consumers, which is what promotes this out of
 * any one route's `_components/` per docs/04 §7's "promoted only on its
 * second consumer" rule.
 *
 * ARCHITECTURE NOTE: this file lives in `components/commerce/`, which per
 * docs/04 §3 must never import from `server/**`. It therefore knows
 * nothing about `Prisma`, `CatalogFacets`, or `ProductSummary` — the
 * plain, serialisable `CatalogListing*` types below are the boundary. The
 * `app/[locale]/(storefront)/...` page files (which *are* allowed to
 * import `server/services/catalog`) do the translation from server
 * shapes into these props.
 *
 * STATE MODEL: filters/sort/page all live in the URL's query string, not
 * component state — every control here reads the current query via
 * `useSearchParams()` and "changes" it by pushing a new URL (via the
 * locale-aware `router`/`pathname` from `@/i18n/navigation`, so a filter
 * change on the Nepali site correctly stays on `/ne/...`). This makes the
 * listing shareable/bookmarkable/back-button-correct for free, and keeps
 * the actual data fetch a plain server-side `searchParams` read in the
 * page component — no client-side data fetching exists here at all.
 */
import { useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { productSortSchema, type ProductSort } from "@/lib/validation/catalog";
import { formatNPR, paisaToRupees, rupeesToPaisa } from "@/lib/money";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { ProductGrid } from "@/components/commerce/product-grid";
import type { ProductCardData } from "@/components/commerce/product-card";
import { FilterRail } from "@/components/commerce/filter-rail";
import { MobileFilterSheet } from "@/components/commerce/mobile-filter-sheet";
import type { FilterGroupProps } from "@/components/commerce/filter-group";
import { ResultCount } from "@/components/commerce/result-count";
import { SortSelect, type SortOption } from "@/components/commerce/sort-select";

export interface CatalogListingFacetBrand {
  slug: string;
  name: string;
  count: number;
}

export interface CatalogListingSpecTextFacet {
  key: string;
  label: string;
  dataType: "TEXT";
  options: { value: string; label: string; count: number }[];
}

export interface CatalogListingSpecNumberFacet {
  key: string;
  label: string;
  dataType: "NUMBER";
  min: number;
  max: number;
  unit: string | null;
}

export type CatalogListingSpecFacet = CatalogListingSpecTextFacet | CatalogListingSpecNumberFacet;

export interface CatalogListingFacets {
  brands: CatalogListingFacetBrand[];
  specs: CatalogListingSpecFacet[];
  priceRangePaisa: { min: number; max: number } | null;
}

export interface CatalogListingPagination {
  page: number;
  totalPages: number;
  total: number;
  hasNext: boolean;
}

export interface CatalogListingProps {
  products: ProductCardData[];
  facets: CatalogListingFacets;
  pagination: CatalogListingPagination;
  /**
   * `false` for the search results page — search is always ranked by
   * relevance (docs/07 §3.1's dedicated `GET /api/v1/search`), and
   * `catalog/search.ts` doesn't accept a `sort` parameter at all, so
   * showing a sort control there would offer a choice that does nothing.
   */
  enableSort?: boolean;
  className?: string;
}

/** UI vocabulary (`SortOption`, docs/02 §2.1's exact 6 options) ↔ API vocabulary (`ProductSort`, docs/07 §3.1). Two closed unions that mean the same six things with different spellings. */
const UI_TO_API_SORT: Record<SortOption, ProductSort> = {
  relevance: "relevance",
  "price-asc": "price",
  "price-desc": "-price",
  newest: "-createdAt",
  "best-selling": "-sales",
  discount: "-discount",
};

const API_TO_UI_SORT: Record<ProductSort, SortOption> = {
  relevance: "relevance",
  price: "price-asc",
  "-price": "price-desc",
  "-createdAt": "newest",
  "-sales": "best-selling",
  "-discount": "discount",
};

function parseSort(searchParams: URLSearchParams): SortOption {
  const raw = searchParams.get("sort");
  if (!raw) return "relevance";
  const parsed = productSortSchema.safeParse(raw);
  return parsed.success ? API_TO_UI_SORT[parsed.data] : "relevance";
}

function parsePriceRupees(searchParams: URLSearchParams, key: string): number | null {
  const raw = searchParams.get(key);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** A compact page-number list with `"ellipsis"` markers, always including page 1, the last page, and one page either side of the current one — the standard "1 … 4 5 6 … 12" pattern. */
function buildPageList(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);

  const keep = new Set<number>([1, total, current - 1, current, current + 1]);
  const sorted = [...keep].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | "ellipsis")[] = [];
  let previous = 0;
  for (const page of sorted) {
    if (page - previous > 1) result.push("ellipsis");
    result.push(page);
    previous = page;
  }
  return result;
}

export function CatalogListing({
  products,
  facets,
  pagination,
  enableSort = true,
  className,
}: CatalogListingProps) {
  const t = useTranslations("catalog");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedBrands = searchParams.getAll("brand");
  const sort = parseSort(searchParams);
  const priceGteRupees = parsePriceRupees(searchParams, "priceGte");
  const priceLteRupees = parsePriceRupees(searchParams, "priceLte");

  function pushParams(params: URLSearchParams) {
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  /** Any filter or sort change resets to page 1 — the current page number almost never still makes sense against a different result set. */
  function updateFilters(mutate: (params: URLSearchParams) => void) {
    const params = new URLSearchParams(searchParams.toString());
    mutate(params);
    params.delete("page");
    pushParams(params);
  }

  function goToPage(page: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(page));
    pushParams(params);
  }

  function clearAll() {
    router.push(pathname);
  }

  const filterGroups: FilterGroupProps[] = [];

  if (facets.brands.length > 0) {
    filterGroups.push({
      type: "checkbox",
      title: t("brand"),
      options: facets.brands.map((brand) => ({
        label: brand.name,
        value: brand.slug,
        count: brand.count,
      })),
      selected: selectedBrands,
      onChange: (selected) =>
        updateFilters((params) => {
          params.delete("brand");
          selected.forEach((slug) => params.append("brand", slug));
        }),
    });
  }

  if (facets.priceRangePaisa) {
    const min = Math.floor(paisaToRupees(facets.priceRangePaisa.min));
    const max = Math.ceil(paisaToRupees(facets.priceRangePaisa.max));
    filterGroups.push({
      type: "range",
      title: t("priceRange"),
      min,
      max,
      value: [priceGteRupees ?? min, priceLteRupees ?? max],
      onChange: ([lo, hi]) =>
        updateFilters((params) => {
          params.set("priceGte", String(Math.round(lo)));
          params.set("priceLte", String(Math.round(hi)));
        }),
      formatValue: (n) => formatNPR(rupeesToPaisa(Math.round(n))),
    });
  }

  // JUDGMENT CALL: numeric spec facets (dataType "NUMBER" — e.g. screen
  // size, wattage) are not rendered as a filter control in this pass.
  // `FilterGroup`'s "range" type exists and could support it, but each
  // one needs its own min/max/unit-aware slider wired independently of
  // the shared price range above; real, but scoped out until a category
  // with numeric specs (Monitors, CPUs) actually needs it in front of a
  // user. Text/select specs (RAM, colour, storage) work today.
  for (const spec of facets.specs) {
    if (spec.dataType !== "TEXT") continue;
    const selected = searchParams.getAll(`spec.${spec.key}`);
    filterGroups.push({
      type: "checkbox",
      title: spec.label,
      options: spec.options.map((option) => ({
        label: option.label,
        value: option.value,
        count: option.count,
      })),
      selected,
      onChange: (nextSelected) =>
        updateFilters((params) => {
          params.delete(`spec.${spec.key}`);
          nextSelected.forEach((value) => params.append(`spec.${spec.key}`, value));
        }),
    });
  }

  const pageList = buildPageList(pagination.page, pagination.totalPages);

  return (
    <div className={className}>
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        {filterGroups.length > 0 && <FilterRail groups={filterGroups} onClearAll={clearAll} />}

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <ResultCount count={pagination.total} />
              {filterGroups.length > 0 && (
                <MobileFilterSheet
                  groups={filterGroups}
                  onClearAll={clearAll}
                  resultCount={pagination.total}
                  className="lg:hidden"
                />
              )}
            </div>
            {enableSort && (
              <SortSelect
                value={sort}
                onChange={(next) =>
                  updateFilters((params) => {
                    // `next` is drawn from the closed `SortOption` union `SortSelect` itself
                    // enforces, not arbitrary input — safe to index.
                    // eslint-disable-next-line security/detect-object-injection
                    params.set("sort", UI_TO_API_SORT[next]);
                  })
                }
              />
            )}
          </div>

          <ProductGrid
            products={products}
            emptyAction={
              <Button variant="outline" onClick={clearAll}>
                {t("clearFilters")}
              </Button>
            }
          />

          {pagination.totalPages > 1 && (
            <Pagination className="mt-8">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    disabled={pagination.page <= 1}
                    onClick={() => goToPage(pagination.page - 1)}
                  />
                </PaginationItem>
                {pageList.map((entry, index) =>
                  entry === "ellipsis" ? (
                    // Ellipsis markers have no stable identity of their own — `index` is
                    // stable within one render of a fixed `pageList`, which is all `key`
                    // needs here.
                    <PaginationItem key={`ellipsis-${index}`}>
                      <PaginationEllipsis />
                    </PaginationItem>
                  ) : (
                    <PaginationItem key={entry}>
                      <PaginationLink
                        isActive={entry === pagination.page}
                        onClick={() => goToPage(entry)}
                      >
                        {entry}
                      </PaginationLink>
                    </PaginationItem>
                  ),
                )}
                <PaginationItem>
                  <PaginationNext
                    disabled={!pagination.hasNext}
                    onClick={() => goToPage(pagination.page + 1)}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </div>
      </div>
    </div>
  );
}
