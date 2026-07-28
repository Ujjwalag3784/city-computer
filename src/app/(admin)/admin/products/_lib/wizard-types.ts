/**
 * Client-side state shapes shared by `product-wizard.tsx` and its four
 * step components (`_components/*-step.tsx`). Route-private (`_lib/`),
 * same as `(admin)/_lib/nav.ts` — nothing outside this route needs these.
 *
 * These mirror the *input* Zod schemas in `lib/validation/admin/product.ts`
 * closely but aren't identical to them: form state needs an editable
 * `""` for a not-yet-typed number field (`pricePaisa: paisaSchema` has no
 * empty state; `priceRupees: number | ""` does), and money is held here
 * as whole rupees rather than paisa, since that's what an admin actually
 * types (`MoneyInput`'s own doc comment). `product-wizard.tsx`'s save
 * handlers convert this shape into each step's real input schema shape
 * right before calling a Server Action.
 */
import type { ConditionType } from "@/generated/prisma/client";
import type { DropzoneImage } from "@/components/admin/image-dropzone";
import type { ProductSpecsInput } from "@/lib/validation/admin/product";

/** One row of Step 3's spec sheet — a template-driven field or a free-form "+ Add another detail" row; see `details-step.tsx`'s doc comment for how the two are told apart. */
export type ProductSpecRow = ProductSpecsInput["specs"][number];

export interface BasicInfoFormState {
  name: string;
  shortTitle: string;
  description: string;
  brandId: string;
  primaryCategoryId: string;
  additionalCategoryIds: string[];
  priceRupees: number | "";
  compareAtPriceRupees: number | "";
  stockQuantity: number | "";
  productCode: string;
  conditionType: ConditionType;
  warrantyMonths: number | "";
  warrantyText: string;
}

export function emptyBasicInfo(): BasicInfoFormState {
  return {
    name: "",
    shortTitle: "",
    description: "",
    brandId: "",
    primaryCategoryId: "",
    additionalCategoryIds: [],
    priceRupees: "",
    compareAtPriceRupees: "",
    stockQuantity: "",
    productCode: "",
    conditionType: "NEW" as ConditionType,
    warrantyMonths: "",
    warrantyText: "",
  };
}

export interface SeoFormState {
  metaTitle: string;
  metaDescription: string;
  canonicalOverride: string;
}

export function emptySeo(): SeoFormState {
  return { metaTitle: "", metaDescription: "", canonicalOverride: "" };
}

export interface WizardFormState {
  basicInfo: BasicInfoFormState;
  photos: DropzoneImage[];
  specs: ProductSpecRow[];
  seo: SeoFormState;
}

export function emptyWizardState(): WizardFormState {
  return { basicInfo: emptyBasicInfo(), photos: [], specs: [], seo: emptySeo() };
}
