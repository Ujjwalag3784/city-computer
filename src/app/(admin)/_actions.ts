"use server";

/**
 * `(admin)/layout.tsx` passes `globalAdminSearchAction` down to
 * `AdminShell` -> `AdminTopBar` (both Client Components in `components/
 * admin/`) as a prop, rather than those components importing a Server
 * Action from `app/` directly — docs/04-REPOSITORY-STRUCTURE.md §3's
 * "`components/` never imports from `app/`" boundary, applied to Server
 * Actions the same way it's already applied to `server/**`. A Server
 * Component passing a Server Action reference down to a Client
 * Component as a prop is a supported, ordinary Next.js pattern; this
 * file exists so `layout.tsx` has one to pass.
 *
 * This action returns `GlobalSearchGroup[]` (`AdminTopBar`/`GlobalSearch`'s
 * own presentational shape from `components/admin/global-search.tsx`),
 * not `server/services/admin/search.ts`'s `GlobalSearchResults` — the
 * ESLint `no-restricted-imports` rule for `components/**` (docs/04 §3)
 * blocks it from importing anything under `server/**`, including just the
 * type, so the domain-shaped-to-presentation-shaped mapping has to happen
 * here, the one layer allowed to see both sides.
 *
 * Brand and category hits link to their list pages (`/admin/brands`,
 * `/admin/categories`), not a specific record: both are edited via a
 * dialog on that single list page (Phase 5b), not a per-record route, and
 * neither page has query-param deep-linking to auto-open one record's
 * dialog yet. Docs/09 §9's "jump straight to the record" is fully met for
 * products (which do have `/admin/products/[id]/edit`); for brands/
 * categories this is a documented simplification, not an oversight.
 */
import { auth } from "@/server/auth";
import { globalAdminSearch } from "@/server/services/admin/search";
import type { GlobalSearchGroup } from "@/components/admin/global-search";
import { formatNPR } from "@/lib/money";

export async function globalAdminSearchAction(query: string): Promise<GlobalSearchGroup[]> {
  const session = await auth();
  if (!session) return [];

  const results = await globalAdminSearch(query, session.user.permissionKeys);
  const groups: GlobalSearchGroup[] = [];

  if (results.products) {
    groups.push({
      label: "Products",
      count: results.products.length,
      results: results.products.map((product) => ({
        id: product.id,
        title: product.name,
        subtitle: formatNPR(product.pricePaisa),
        href: `/admin/products/${product.id}/edit`,
      })),
    });
  }

  if (results.brands) {
    groups.push({
      label: "Brands",
      count: results.brands.length,
      results: results.brands.map((brand) => ({
        id: brand.id,
        title: brand.name,
        href: "/admin/brands",
      })),
    });
  }

  if (results.categories) {
    groups.push({
      label: "Categories",
      count: results.categories.length,
      results: results.categories.map((category) => ({
        id: category.id,
        title: category.name,
        subtitle: category.path,
        href: "/admin/categories",
      })),
    });
  }

  return groups;
}
