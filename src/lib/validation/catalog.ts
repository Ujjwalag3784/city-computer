/**
 * Shared Zod schemas for the catalogue read path — docs/07-API-DESIGN.md
 * §2 ("Filtering and sorting") and §3.1.
 *
 * SCOPE NOTE: these schemas validate an already-*structured* input object,
 * not a raw query string. Turning `?filter[spec.ram_gb]=16&sort=-price`
 * into `{ specFilters: { ram_gb: ["16"] }, sort: "-price" }` is the job of
 * the route handler / page that reads `searchParams` (docs/04's
 * `app/[locale]/(storefront)/...` route tree, Phase 4 task 3/3, not yet
 * built) — the service layer only needs to agree on the shape once it's
 * parsed. Keeping the bracket-notation parsing out of this file keeps it
 * testable without a fake `URLSearchParams`.
 */
import { z } from "zod";
import { ConditionType } from "@/generated/prisma/client";
import { isValidSlugFormat } from "@/lib/slug";

/** docs/06-DATA-MODEL.md §1: slugs are `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 80 chars per segment — reusing `lib/slug.ts`'s own pattern (and its `eslint-disable` for the security linter's regex heuristic) rather than redeclaring it here. A category *path* is one or more slug segments joined by `/` (docs/06 §4's materialised path, e.g. `laptops/gaming`). */
export const categoryPathSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine(
    (value) => value.split("/").every((segment) => isValidSlugFormat(segment)),
    "Invalid category path.",
  );

export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .refine(isValidSlugFormat, "Invalid slug.");

/** docs/07 §3.1 `sort` values, whitelisted — an unrecognised sort is a validation error, never a silent ignore (docs/07 §2's "Unknown keys → 422" rule applied to sort too). */
export const productSortSchema = z.enum([
  "relevance",
  "price",
  "-price",
  "-createdAt",
  "-sales",
  "-discount",
]);
export type ProductSort = z.infer<typeof productSortSchema>;

export const productAvailabilitySchema = z.enum(["in_stock", "out_of_stock", "all"]);
export type ProductAvailability = z.infer<typeof productAvailabilitySchema>;

/** Money filters travel in **rupees** at the API boundary per docs/07 §2 ("Prices in filters are in rupees for URL readability") — conversion to paisa happens in the route layer via `rupeesToPaisa`, so by the time it reaches this schema it's already paisa. Kept as a plain non-negative int here; `lib/money.ts` owns the actual paisa invariants. */
const paisaSchema = z.number().int().nonnegative();

/**
 * A single spec filter value set — `{ ram_gb: ["16", "32"] }` (OR within a
 * key) or a numeric range `{ screen_size_in: { gte: 14, lte: 16 } }`.
 * Which keys are legal at all is a runtime whitelist against
 * `SpecField.isFilterable` (see `server/services/catalog/facet.ts`'s
 * `getFilterableSpecKeys`), not something Zod alone can express — Zod only
 * checks the *shape* here.
 */
export const specTextFilterSchema = z.record(z.string(), z.array(z.string().trim().min(1)).min(1));
export const specRangeFilterSchema = z.record(
  z.string(),
  z.object({ gte: z.number().optional(), lte: z.number().optional() }),
);

export const productListInputSchema = z.object({
  categoryPath: categoryPathSchema.optional(),
  brandSlugs: z.array(slugSchema).max(20).optional(),
  q: z.string().trim().max(200).optional(),
  priceGtePaisa: paisaSchema.optional(),
  priceLtePaisa: paisaSchema.optional(),
  specFilters: specTextFilterSchema.optional(),
  specRangeFilters: specRangeFilterSchema.optional(),
  availability: productAvailabilitySchema.default("all"),
  branchSlug: slugSchema.optional(),
  condition: z.nativeEnum(ConditionType).optional(),
  onSale: z.boolean().optional(),
  sort: productSortSchema.default("relevance"),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(24),
});

export type ProductListInput = z.infer<typeof productListInputSchema>;

/** docs/07 §3.1 `GET /api/v1/search?q=`. Search always requires a non-empty query — an empty `q` is what `/products` (no `q`) is for. */
export const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "Enter a search term.").max(200),
  page: z.number().int().min(1).default(1),
  perPage: z.number().int().min(1).max(100).default(24),
});

export type SearchQueryInput = z.infer<typeof searchQuerySchema>;
