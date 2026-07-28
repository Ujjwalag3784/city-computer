/**
 * Global admin search — docs/09-ADMIN-DAD-MODE.md §9: a single search box
 * reachable with `Ctrl/⌘K`, returning grouped results across "products,
 * orders, customers, brands, categories, discount codes, blog posts,
 * repair jobs, and PC builds."
 *
 * SCOPE: only PRODUCTS, BRANDS, and CATEGORIES are searched here — the
 * only three domains with a real admin write service (and real seeded
 * data) as of this pass. Orders, customers, coupons, blog posts, repair
 * tickets, and PC builds don't have their own admin services yet
 * (they're later phases — Phase 6 onward). `GlobalSearchResults` below
 * simply omits a key for anything not actually searched, rather than
 * returning an empty array that would misleadingly read as "searched,
 * found nothing" for a domain that was never queried at all.
 *
 * "Results are permission-filtered" (docs/09 §9): products are visible
 * to anyone with `product:view` (every admin role except none); brands
 * and categories only appear for an actor holding `brand:write` /
 * `category:write` respectively, matching who can actually reach
 * `/admin/brands` and `/admin/categories` in the first place.
 */
import "server-only";
import { db } from "@/server/db";
import { Locale } from "@/generated/prisma/client";
import { resolveTranslated } from "@/server/services/catalog/locale-helpers";

export interface GlobalSearchProductHit {
  id: string;
  name: string;
  slug: string;
  pricePaisa: number;
}

export interface GlobalSearchBrandHit {
  id: string;
  name: string;
  slug: string;
}

export interface GlobalSearchCategoryHit {
  id: string;
  name: string;
  path: string;
}

export interface GlobalSearchResults {
  products?: GlobalSearchProductHit[];
  brands?: GlobalSearchBrandHit[];
  categories?: GlobalSearchCategoryHit[];
}

const RESULTS_PER_GROUP = 6;

export async function globalAdminSearch(
  query: string,
  permissionKeys: readonly string[],
): Promise<GlobalSearchResults> {
  const q = query.trim();
  if (q.length === 0) return {};

  const results: GlobalSearchResults = {};

  if (permissionKeys.includes("product:view")) {
    const products = await db.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { variants: { some: { sku: { contains: q, mode: "insensitive" } } } },
        ],
      },
      take: RESULTS_PER_GROUP,
      orderBy: { updatedAt: "desc" },
      include: { variants: { where: { isDefault: true }, take: 1 } },
    });
    results.products = products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      pricePaisa: product.variants[0]?.pricePaisa ?? 0,
    }));
  }

  if (permissionKeys.includes("brand:write")) {
    const brands = await db.brand.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      take: RESULTS_PER_GROUP,
      orderBy: { name: "asc" },
    });
    results.brands = brands.map((brand) => ({ id: brand.id, name: brand.name, slug: brand.slug }));
  }

  if (permissionKeys.includes("category:write")) {
    const categories = await db.category.findMany({
      where: { translations: { some: { name: { contains: q, mode: "insensitive" } } } },
      take: RESULTS_PER_GROUP,
      include: { translations: true },
    });
    results.categories = categories.map((category) => ({
      id: category.id,
      name: resolveTranslated(category.translations, Locale.EN, "name", category.slug),
      path: category.path,
    }));
  }

  return results;
}
