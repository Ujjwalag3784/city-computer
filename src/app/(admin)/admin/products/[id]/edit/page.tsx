import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError, NotFoundError } from "@/lib/errors";
import { listBrandsForAdmin } from "@/server/services/admin/brand";
import { listCategoriesForAdmin, type AdminCategoryNode } from "@/server/services/admin/category";
import {
  getProductSpecs,
  getProductWizardData,
  getSpecTemplateFields,
} from "@/server/services/admin/product";
import type { ComboboxOption } from "@/components/ui/combobox";
import { ProductWizard } from "../../product-wizard";

export const metadata: Metadata = {
  title: "Edit product — Admin — City Computer Systems",
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
 * `/admin/products/[id]/edit` — reuses the same four-step `ProductWizard`
 * as `/admin/products/new`, pre-filled from `getProductWizardData`.
 * Gated on `product:update` rather than the list page's broader
 * `product:view` — STAFF can see the product list (§3's module map) but
 * has no `product:create`/`product:update`, so every one of the wizard's
 * four save actions would fail for them; docs/09 §8's "Actions they lack
 * permission for are not rendered at all — never shown-then-denied" reads
 * more naturally here as "the whole edit screen isn't shown" than as
 * "shown read-only", since nothing in this wizard has a read-only mode.
 */
export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "product:update");
  } catch (error) {
    if (error instanceof UnauthenticatedError)
      redirect(`/auth/login?callbackUrl=/admin/products/${id}/edit`);
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  let wizardData;
  try {
    wizardData = await getProductWizardData(id);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const [brands, categories, specs, templateFields] = await Promise.all([
    listBrandsForAdmin(),
    listCategoriesForAdmin(),
    getProductSpecs(id),
    getSpecTemplateFields(wizardData.basicInfo.primaryCategoryId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Edit product</h1>
      </div>

      <ProductWizard
        existingProductId={id}
        initialData={wizardData}
        initialSpecs={specs}
        initialTemplateFields={templateFields}
        brandOptions={brands.map((brand) => ({ value: brand.id, label: brand.name }))}
        categoryOptions={flattenCategoryOptions(categories)}
      />
    </div>
  );
}
