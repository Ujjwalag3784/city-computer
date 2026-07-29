import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { listBrandsForAdmin } from "@/server/services/admin/brand";
import { listCategoriesForAdmin, type AdminCategoryNode } from "@/server/services/admin/category";
import type { ComboboxOption } from "@/components/ui/combobox";
import { ProductWizard } from "../product-wizard";
import { LearnMoreLink } from "@/components/admin/learn-more-link";

export const metadata: Metadata = {
  title: "Add a product — Admin — City Computer Systems",
};

function flattenCategoryOptions(nodes: AdminCategoryNode[], depth = 0): ComboboxOption[] {
  const options: ComboboxOption[] = [];
  for (const node of nodes) {
    options.push({ value: node.id, label: `${"— ".repeat(depth)}${node.name}` });
    options.push(...flattenCategoryOptions(node.children, depth + 1));
  }
  return options;
}

/**
 * `/admin/products/new` — docs/09-ADMIN-DAD-MODE.md §3's "Add a product"
 * (OWNER, MANAGER only). Loads the brand/category picker options once,
 * server-side, the same way `admin/brands/page.tsx` loads its table data
 * — `ProductWizard` itself never fetches these on mount, avoiding a
 * client-side waterfall before Step 1 can even render its dropdowns.
 */
export default async function NewProductPage() {
  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "product:create");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect("/auth/login?callbackUrl=/admin/products/new");
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const [brands, categories] = await Promise.all([listBrandsForAdmin(), listCategoriesForAdmin()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Add a product</h1>
        <LearnMoreLink slug="adding-your-first-product" />
      </div>

      <ProductWizard
        brandOptions={brands.map((brand) => ({ value: brand.id, label: brand.name }))}
        categoryOptions={flattenCategoryOptions(categories)}
      />
    </div>
  );
}
