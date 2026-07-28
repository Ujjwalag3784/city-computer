/**
 * Full-text product search — docs/06-DATA-MODEL.md §11 ("Full-text
 * search"), docs/07-API-DESIGN.md §3.1 (`GET /api/v1/search?q=`).
 *
 * KNOWN GAP, same one noted in PROGRESS.md and in `prisma/schema/catalog.prisma`'s
 * `Product.searchVector` comment: this query is syntactically complete and
 * ready to run, but `search_vector` is a trigger-maintained column
 * (`prisma/sql/manual-constraints.sql` §5) that has never actually been
 * applied to a real database from this sandbox — no Postgres connection,
 * no network access to Prisma's engine-binary CDN (see PROGRESS.md).
 * Against an unmigrated database, `search_vector` is `NULL` on every row,
 * so this returns zero results. That is the migration's absence showing
 * through, not a bug in the query below — running
 * `prisma/sql/manual-constraints.sql` §5 on a real machine is what makes
 * this start returning rows.
 */
import "server-only";
import { db } from "@/server/db";
import { Locale, Prisma } from "@/generated/prisma/client";
import { validationErrorFromZodIssues } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { searchQuerySchema } from "@/lib/validation/catalog";
import { buildPaginationMeta, type PaginationMeta } from "./locale-helpers";
import { getProductSummariesByIds, type ProductSummary } from "./product";

export interface SearchProductsResult {
  items: ProductSummary[];
  pagination: PaginationMeta;
  query: string;
}

interface SearchRankRow {
  id: string;
}

interface SearchCountRow {
  count: bigint;
}

/**
 * `websearch_to_tsquery` (Postgres 11+) rather than `plainto_tsquery` —
 * it understands quoted phrases and `-exclude` terms the way a shopper
 * actually types into a search box, and degrades gracefully on
 * punctuation that would otherwise make `to_tsquery` throw.
 */
export async function searchProducts(
  input: unknown,
  locale: Locale = Locale.EN,
): Promise<SearchProductsResult> {
  const parsed = searchQuerySchema.safeParse(input);
  if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
  const { q, page, perPage } = parsed.data;
  const offset = (page - 1) * perPage;

  const [rankedRows, countRows] = await Promise.all([
    db.$queryRaw<SearchRankRow[]>(Prisma.sql`
      SELECT id
      FROM products
      WHERE status = 'ACTIVE'
        AND deleted_at IS NULL
        AND search_vector @@ websearch_to_tsquery('english', ${q})
      ORDER BY ts_rank_cd(search_vector, websearch_to_tsquery('english', ${q})) DESC
      LIMIT ${perPage}
      OFFSET ${offset}
    `),
    db.$queryRaw<SearchCountRow[]>(Prisma.sql`
      SELECT COUNT(*)::bigint AS count
      FROM products
      WHERE status = 'ACTIVE'
        AND deleted_at IS NULL
        AND search_vector @@ websearch_to_tsquery('english', ${q})
    `),
  ]);

  const total = Number(countRows[0]?.count ?? 0n);
  const orderedIds = rankedRows.map((row) => row.id);
  const items = await getProductSummariesByIds(orderedIds, locale);

  // docs/06 §10: "Zero-result queries are a merchandising instrument" —
  // logged unconditionally, including (especially) when `total === 0`.
  // Never allowed to fail the search itself: a logging outage must not
  // turn into a broken search box.
  void logSearchQuery({ query: q, resultCount: total, locale }).catch((error: unknown) => {
    logger.error({ error }, "searchProducts: failed to write SearchQueryLog (non-fatal)");
  });

  return { items, pagination: buildPaginationMeta(page, perPage, total), query: q };
}

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

async function logSearchQuery(params: {
  query: string;
  resultCount: number;
  locale: Locale;
  clickedProductId?: string;
}): Promise<void> {
  await db.searchQueryLog.create({
    data: {
      query: params.query,
      normalisedQuery: normalizeQuery(params.query),
      resultCount: params.resultCount,
      hasResults: params.resultCount > 0,
      clickedProductId: params.clickedProductId ?? null,
      locale: params.locale,
    },
  });
}
