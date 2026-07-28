"use server";

/**
 * Server Actions backing the product wizard (docs/09-ADMIN-DAD-MODE.md
 * §5.1) and the product list's inline price/stock quick-edit (§5.2).
 * Same shape as `admin/categories/_actions.ts`: permission check ->
 * validate -> call the service -> revalidate -> plain `ActionResult`.
 */
import { revalidatePath } from "next/cache";
import { validationErrorFromZodIssues } from "@/lib/errors";
import {
  productBasicInfoSchema,
  productPhotosInputSchema,
  productSeoInputSchema,
  productSpecsInputSchema,
  quickPriceUpdateSchema,
  quickStockUpdateSchema,
} from "@/lib/validation/admin/product";
import { requireAdminPermission } from "@/server/auth/require-admin-permission";
import {
  findSimilarProductNames,
  getProductSpecs,
  getProductWizardData,
  getPublishReadiness,
  getSpecTemplateFields,
  publishProduct,
  quickUpdatePrice,
  saveBasicInfo,
  savePhotos,
  saveSeo,
  saveSpecs,
  unpublishProduct,
  type AdminSpecFieldOption,
  type ProductWizardData,
  type ProductWizardSummary,
  type PublishReadiness,
  type QuickPriceUpdateResult,
  type SimilarProductCandidate,
} from "@/server/services/admin/product";
import { adjustVariantStock, type PrimaryStockLevel } from "@/server/services/admin/stock";
import { listBrandsForAdmin } from "@/server/services/admin/brand";
import { listCategoriesForAdmin, type AdminCategoryNode } from "@/server/services/admin/category";
import type { ComboboxOption } from "@/components/ui/combobox";
import { runAdminAction, type ActionResult } from "../../_lib/action-result";

const PRODUCTS_PATH = "/admin/products";

/**
 * Step 1's Brand/Category pickers (docs/09 §5.1: "searchable select" /
 * "tree picker") both reuse the generic `Combobox` primitive rather than a
 * bespoke tree widget — see `basic-info-step.tsx`'s own doc comment for
 * why a real expand/collapse tree UI is out of scope for this pass.
 * Category labels are indented by depth ("— " per level) so the
 * hierarchy is still visible in a flat list.
 */
function flattenCategoryOptions(nodes: AdminCategoryNode[], depth = 0): ComboboxOption[] {
  const options: ComboboxOption[] = [];
  for (const node of nodes) {
    options.push({ value: node.id, label: `${"— ".repeat(depth)}${node.name}` });
    options.push(...flattenCategoryOptions(node.children, depth + 1));
  }
  return options;
}

export async function listBrandOptionsAction(): Promise<ActionResult<ComboboxOption[]>> {
  return runAdminAction(async () => {
    await requireAdminPermission("product:view");
    const brands = await listBrandsForAdmin();
    return brands.map((brand) => ({ value: brand.id, label: brand.name }));
  });
}

export async function listCategoryOptionsAction(): Promise<ActionResult<ComboboxOption[]>> {
  return runAdminAction(async () => {
    await requireAdminPermission("product:view");
    const categories = await listCategoriesForAdmin();
    return flattenCategoryOptions(categories);
  });
}

export async function checkDuplicateProductNameAction(
  name: string,
  excludeProductId?: string,
): Promise<ActionResult<SimilarProductCandidate[]>> {
  return runAdminAction(async () => {
    await requireAdminPermission("product:view");
    return findSimilarProductNames(name, excludeProductId);
  });
}

export async function getSpecTemplateFieldsAction(
  categoryId: string,
): Promise<ActionResult<AdminSpecFieldOption[]>> {
  return runAdminAction(async () => {
    await requireAdminPermission("product:view");
    return getSpecTemplateFields(categoryId);
  });
}

export async function loadProductWizardDataAction(
  productId: string,
): Promise<ActionResult<ProductWizardData>> {
  return runAdminAction(async () => {
    await requireAdminPermission("product:view");
    return getProductWizardData(productId);
  });
}

export async function loadProductSpecsAction(
  productId: string,
): Promise<ActionResult<Awaited<ReturnType<typeof getProductSpecs>>>> {
  return runAdminAction(async () => {
    await requireAdminPermission("product:view");
    return getProductSpecs(productId);
  });
}

export async function saveBasicInfoAction(
  input: unknown,
  existingProductId?: string,
): Promise<ActionResult<ProductWizardSummary>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("product:create");
    const parsed = productBasicInfoSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    const result = await saveBasicInfo(parsed.data, actor, existingProductId);
    revalidatePath(PRODUCTS_PATH);
    return result;
  });
}

export async function savePhotosAction(
  productId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("product:update");
    const parsed = productPhotosInputSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    await savePhotos(productId, parsed.data, actor);
    revalidatePath(PRODUCTS_PATH);
  });
}

export async function saveSpecsAction(
  productId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("product:update");
    const parsed = productSpecsInputSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    await saveSpecs(productId, parsed.data, actor);
    revalidatePath(PRODUCTS_PATH);
  });
}

export async function saveSeoAction(
  productId: string,
  input: unknown,
): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("product:update");
    const parsed = productSeoInputSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    await saveSeo(productId, parsed.data, actor);
    revalidatePath(PRODUCTS_PATH);
  });
}

export async function getPublishReadinessAction(
  productId: string,
): Promise<ActionResult<PublishReadiness>> {
  return runAdminAction(async () => {
    await requireAdminPermission("product:view");
    return getPublishReadiness(productId);
  });
}

export async function publishProductAction(productId: string): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("product:update");
    await publishProduct(productId, actor);
    revalidatePath(PRODUCTS_PATH);
  });
}

export async function unpublishProductAction(productId: string): Promise<ActionResult<void>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("product:update");
    await unpublishProduct(productId, actor);
    revalidatePath(PRODUCTS_PATH);
  });
}

export async function quickUpdatePriceAction(
  input: unknown,
): Promise<ActionResult<QuickPriceUpdateResult>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("price:update");
    const parsed = quickPriceUpdateSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    const result = await quickUpdatePrice(
      parsed.data.variantId,
      parsed.data.pricePaisa,
      parsed.data.compareAtPricePaisa,
      actor,
    );
    revalidatePath(PRODUCTS_PATH);
    return result;
  });
}

export async function quickUpdateStockAction(
  input: unknown,
): Promise<ActionResult<PrimaryStockLevel>> {
  return runAdminAction(async () => {
    const actor = await requireAdminPermission("stock:update");
    const parsed = quickStockUpdateSchema.safeParse(input);
    if (!parsed.success) throw validationErrorFromZodIssues(parsed.error.issues);
    const result = await adjustVariantStock(
      parsed.data.variantId,
      parsed.data.quantity,
      parsed.data.reason,
      actor,
      parsed.data.note,
    );
    revalidatePath(PRODUCTS_PATH);
    return result;
  });
}
