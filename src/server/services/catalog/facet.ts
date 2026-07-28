/**
 * Faceted filtering — docs/06-DATA-MODEL.md §4 ("`ProductSpec` ... this is
 * what powers faceted filtering"), docs/07-API-DESIGN.md §2 ("Filter keys
 * are whitelisted per resource... from `SpecField.isFilterable`") and
 * §3.1's `meta.facets` response block.
 *
 * JUDGMENT CALL: facet *values and counts* are built directly from
 * `ProductSpec` rows (`key`/`label`/`unit`/`valueText`/`valueNumber`),
 * never from `SpecField`/`SpecTemplate`. `ProductSpec` is the
 * "flexible, human-authored, per-category display and filter layer"
 * docs/06 §4 describes — it already carries everything a facet needs
 * (label, unit, value) denormalised onto each product, so re-joining
 * through the template layer would add complexity for no new
 * information. `SpecTemplate`/`SpecField` *is* still used, in
 * `getFilterableSpecKeys` below, for the one thing `ProductSpec` alone
 * cannot answer: "is this key allowed as a filter at all", independent of
 * whether any product in the current result set happens to have it set.
 */
import "server-only";
import { db } from "@/server/db";
import { getBrandsByIds, type BrandSummary } from "./brand";

export interface FacetValueOption {
  value: string;
  label: string;
  count: number;
}

export interface FacetPriceRange {
  minPaisa: number;
  maxPaisa: number;
}

export interface SpecTextFacet {
  key: string;
  label: string;
  dataType: "TEXT";
  unit: string | null;
  options: FacetValueOption[];
}

export interface SpecNumberFacet {
  key: string;
  label: string;
  dataType: "NUMBER";
  unit: string | null;
  min: number;
  max: number;
}

export type SpecFacet = SpecTextFacet | SpecNumberFacet;

export interface CatalogFacets {
  brands: (BrandSummary & { count: number })[];
  specs: SpecFacet[];
  priceRange: FacetPriceRange | null;
}

const EMPTY_FACETS: CatalogFacets = { brands: [], specs: [], priceRange: null };

/**
 * Builds facet definitions + counts for an already-resolved set of
 * product ids.
 *
 * JUDGMENT CALL (simplification, flagged rather than silently assumed):
 * callers pass the id set matched by category + brand + `q` — the facets
 * describe "what else is available within this listing" but do not yet
 * exclude each facet's *own* active filter from its own count (the
 * standard faceted-search refinement where picking "16GB" still shows
 * "8GB (12)" instead of making it disappear). Implementing that properly
 * needs N near-identical queries, one per active filter dimension, re-run
 * with that one dimension excluded — real, but a separate pass once the
 * storefront UI (Task 32) actually needs it to feel right, rather than
 * built speculatively now.
 */
export async function buildCatalogFacets(productIds: string[]): Promise<CatalogFacets> {
  if (productIds.length === 0) return EMPTY_FACETS;

  const [brandFacets, specFacets, priceRange] = await Promise.all([
    buildBrandFacets(productIds),
    buildSpecFacets(productIds),
    buildPriceRange(productIds),
  ]);

  return { brands: brandFacets, specs: specFacets, priceRange };
}

async function buildBrandFacets(
  productIds: string[],
): Promise<(BrandSummary & { count: number })[]> {
  const counts = await db.product.groupBy({
    by: ["brandId"],
    where: { id: { in: productIds } },
    _count: { _all: true },
  });

  const brandsById = await getBrandsByIds(counts.map((row) => row.brandId));

  return counts
    .map((row) => {
      const brand = brandsById.get(row.brandId);
      if (!brand) return null;
      return { ...brand, count: row._count._all };
    })
    .filter((facet): facet is BrandSummary & { count: number } => facet !== null)
    .sort((a, b) => b.count - a.count);
}

interface RawSpecRow {
  key: string;
  label: string;
  unit: string | null;
  valueText: string | null;
  valueNumber: { toNumber(): number } | null;
}

async function buildSpecFacets(productIds: string[]): Promise<SpecFacet[]> {
  const rows: RawSpecRow[] = await db.productSpec.findMany({
    where: { productId: { in: productIds }, isFilterable: true },
    select: { key: true, label: true, unit: true, valueText: true, valueNumber: true },
  });

  const byKey = new Map<string, RawSpecRow[]>();
  for (const row of rows) {
    const bucket = byKey.get(row.key);
    if (bucket) {
      bucket.push(row);
    } else {
      byKey.set(row.key, [row]);
    }
  }

  const facets: SpecFacet[] = [];
  for (const [key, entries] of byKey) {
    const label = entries[0]?.label ?? key;
    const unit = entries.find((entry) => entry.unit)?.unit ?? null;
    const numericEntries = entries.filter((entry) => entry.valueNumber !== null);

    // A spec key is treated as numeric (range facet) when a majority of
    // its rows across this product set carry a numeric value — a key
    // authored inconsistently (mostly text, a few numbers) renders as a
    // text facet instead, which degrades more gracefully than a range
    // slider with one outlier point.
    if (numericEntries.length > 0 && numericEntries.length >= entries.length / 2) {
      const values = numericEntries.map((entry) => entry.valueNumber?.toNumber() ?? 0);
      facets.push({
        key,
        label,
        dataType: "NUMBER",
        unit,
        min: Math.min(...values),
        max: Math.max(...values),
      });
      continue;
    }

    const counts = new Map<string, number>();
    for (const entry of entries) {
      if (!entry.valueText) continue;
      counts.set(entry.valueText, (counts.get(entry.valueText) ?? 0) + 1);
    }
    if (counts.size === 0) continue;

    facets.push({
      key,
      label,
      dataType: "TEXT",
      unit,
      options: [...counts.entries()]
        .map(([value, count]) => ({ value, label: value, count }))
        .sort((a, b) => b.count - a.count),
    });
  }

  return facets.sort((a, b) => a.label.localeCompare(b.label));
}

async function buildPriceRange(productIds: string[]): Promise<FacetPriceRange | null> {
  const aggregate = await db.variant.aggregate({
    where: { productId: { in: productIds }, isActive: true },
    _min: { pricePaisa: true },
    _max: { pricePaisa: true },
  });
  if (aggregate._min.pricePaisa == null || aggregate._max.pricePaisa == null) return null;
  return { minPaisa: aggregate._min.pricePaisa, maxPaisa: aggregate._max.pricePaisa };
}

/**
 * The `SpecField.isFilterable` whitelist docs/07 §2 requires: "Filter keys
 * are whitelisted per resource. Unknown keys → 422, never silently
 * ignored." Callers (the route/page layer, Task 32) validate an incoming
 * `filter[spec.<key>]` param against this set *before* it ever reaches
 * `catalog/product.ts`'s `listProducts`.
 *
 * Scoped to a category's *active* spec template (`Category.specTemplateId`
 * — "the template currently driving this category's spec form", per the
 * schema comment on `Category.specTemplate`) when a category is given;
 * otherwise every filterable key across every template.
 */
export async function getFilterableSpecKeys(categoryId?: string): Promise<Set<string>> {
  if (!categoryId) {
    const fields = await db.specField.findMany({
      where: { isFilterable: true },
      select: { key: true },
    });
    return new Set(fields.map((field) => field.key));
  }

  const category = await db.category.findUnique({
    where: { id: categoryId },
    select: { specTemplateId: true },
  });
  if (!category?.specTemplateId) return new Set();

  const fields = await db.specField.findMany({
    where: { templateId: category.specTemplateId, isFilterable: true },
    select: { key: true },
  });
  return new Set(fields.map((field) => field.key));
}
