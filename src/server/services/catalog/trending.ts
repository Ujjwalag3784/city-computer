/**
 * Real "Trending now" storefront data — a genuine sales-velocity ranking
 * over the last 7 days, not the `-sales` value in `productSortSchema`.
 * That sort option's own comment in `product.ts` says exactly why it can't
 * be reused here: it silently falls back to newest-first because no
 * `product_sales_30d` rollup exists yet (docs/06 §11), and presenting that
 * fallback under a "Trending now" heading would show newest-first data
 * labelled as popularity — a real product/PDP issue, not a display detail.
 *
 * This mirrors `server/services/admin/dashboard.ts`'s `listBestSellers`
 * (the same honest pattern already proven there — a bounded, real
 * `OrderItem.groupBy` over the actual sales ledger), rather than
 * duplicating that fallback. If there is no real sales history yet (a
 * fresh store), this returns `[]` and the caller hides the section —
 * an honest empty state, not a fabricated "trending" list.
 */
import "server-only";
import { db } from "@/server/db";
import { Locale, OrderStatus } from "@/generated/prisma/client";
import { getProductSummariesByIds, type ProductSummary } from "./product";

/** Same exclusion as the admin dashboard's best-sellers query — cancelled/failed orders never signal real demand. */
const EXCLUDED_FROM_TRENDING_STATUSES: OrderStatus[] = [
  OrderStatus.CANCELLED,
  OrderStatus.PAYMENT_FAILED,
];

/**
 * Top `limit` products by units sold in the last 7 days. Ranks by
 * *variant* sales (`OrderItem.groupBy`) then resolves to parent products,
 * deduplicating while preserving rank — a product with two best-selling
 * variants should still only appear once, at its best rank, matching
 * `dashboard.ts`'s own "product count, not a variant-row count" reasoning
 * for its "almost out of stock" tile.
 */
export async function getTrendingProductSummaries(
  limit: number,
  locale: Locale = Locale.EN,
  now: Date = new Date(),
): Promise<ProductSummary[]> {
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const rows = await db.orderItem.groupBy({
    by: ["variantId"],
    where: {
      variantId: { not: null },
      order: {
        placedAt: { gte: sevenDaysAgo, lte: now },
        status: { notIn: EXCLUDED_FROM_TRENDING_STATUSES },
      },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    // Over-fetch variants, since several can collapse onto the same
    // product once resolved below — trimmed back to `limit` products after.
    take: limit * 3,
  });

  const variantIds = rows.map((row) => row.variantId).filter((id): id is string => id !== null);
  if (variantIds.length === 0) return [];

  const variants = await db.variant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, productId: true },
  });
  const productIdByVariantId = new Map(variants.map((v) => [v.id, v.productId]));

  const rankedProductIds: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    const productId = row.variantId ? productIdByVariantId.get(row.variantId) : undefined;
    if (!productId || seen.has(productId)) continue;
    seen.add(productId);
    rankedProductIds.push(productId);
    if (rankedProductIds.length === limit) break;
  }
  if (rankedProductIds.length === 0) return [];

  // `getProductSummariesByIds` preserves input order, so the sales-rank
  // order established above survives the round trip to full summaries.
  return getProductSummariesByIds(rankedProductIds, locale);
}
