/**
 * `/admin/products` Server Action input shapes — the four-step wizard
 * (docs/09-ADMIN-DAD-MODE.md §5.1), the product list's inline quick-edit
 * (§5.2), and the list's search/filter query params.
 */
import { z } from "zod";
import { ConditionType, StockMovementReason } from "@/generated/prisma/client";

const paisaSchema = z.number().int().min(0);

/** Step 1 — "Basic information". `productCode` is optional: blank means "auto-generate" (docs/09 §5.1's `BRAND-MODEL-NNN`), handled by `server/services/admin/product.ts`, not this schema. */
export const productBasicInfoSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a product name.").max(300),
    /** "Short title" in the doc — pre-filled from `name` by the client if left blank; the service falls back to a truncated `name` too, so an empty string here is never persisted as empty. */
    shortTitle: z.string().trim().max(70).optional(),
    /**
     * The full description isn't one of docs/09 §5.1's listed Step 1
     * fields, but `Product.description`/`shortDescription` are non-
     * nullable columns (docs/06-DATA-MODEL.md §4) with no field in the
     * doc's own table that fills them — a gap between the two docs. This
     * optional field resolves it: left blank, the service derives both
     * from `name`/`shortTitle` instead of blocking the wizard on a field
     * the spec never asked for.
     */
    description: z.string().trim().max(4000).optional(),
    brandId: z.string().min(1, "Choose a brand."),
    primaryCategoryId: z.string().min(1, "Choose a category."),
    additionalCategoryIds: z.array(z.string().min(1)).max(10).default([]),
    pricePaisa: paisaSchema.refine((value) => value > 0, "Enter a price."),
    compareAtPricePaisa: paisaSchema.optional(),
    stockQuantity: z.number().int().min(0, "Enter how many you have."),
    /** Blank means auto-generate — see the module doc comment above. */
    productCode: z.string().trim().max(40).optional(),
    conditionType: z.nativeEnum(ConditionType).default(ConditionType.NEW),
    warrantyMonths: z.number().int().min(0).max(120).optional(),
    warrantyText: z.string().trim().max(200).optional(),
  })
  .refine(
    (value) =>
      value.compareAtPricePaisa === undefined || value.compareAtPricePaisa > value.pricePaisa,
    {
      message: "The offer price needs to be lower than the normal price.",
      path: ["compareAtPricePaisa"],
    },
  );

export type ProductBasicInfoInput = z.infer<typeof productBasicInfoSchema>;

/** Step 3 — "Details". One row per spec field the category's template defines, plus any free-form "+ Add another detail" rows (`key`/`label` chosen by the owner rather than the template). */
export const productSpecInputSchema = z.object({
  key: z.string().trim().min(1).max(80),
  label: z.string().trim().min(1).max(120),
  valueText: z.string().trim().max(300).optional(),
  valueNumber: z.number().optional(),
  valueBool: z.boolean().optional(),
  unit: z.string().trim().max(20).optional(),
  group: z.string().trim().max(60).optional(),
});

export const productSpecsInputSchema = z.object({
  specs: z.array(productSpecInputSchema).max(60),
});

export type ProductSpecsInput = z.infer<typeof productSpecsInputSchema>;

/** Step 4 — "Search information". */
export const productSeoInputSchema = z.object({
  metaTitle: z.string().trim().max(70).optional(),
  metaDescription: z.string().trim().max(200).optional(),
  canonicalOverride: z.string().trim().max(300).optional(),
});

export type ProductSeoInput = z.infer<typeof productSeoInputSchema>;

/** Step 2 — "Photos": attaching already-uploaded `Media` rows (via `media.ts`'s completed-upload flow) to a product, in display order. */
export const productPhotosInputSchema = z.object({
  photos: z
    .array(
      z.object({ mediaId: z.string().min(1), description: z.string().trim().max(300).optional() }),
    )
    .max(20),
});

export type ProductPhotosInput = z.infer<typeof productPhotosInputSchema>;

/** Product list filter chips — docs/09 §5.2: "All · Live · Not published · Out of stock · Almost out of stock · No photo · On offer." */
export const productListFilterSchema = z.enum([
  "all",
  "live",
  "draft",
  "out-of-stock",
  "low-stock",
  "no-photo",
  "on-offer",
]);
export type ProductListFilter = z.infer<typeof productListFilterSchema>;

export const productListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  filter: productListFilterSchema.default("all"),
  page: z.number().int().min(1).default(1),
});
export type ProductListQuery = z.infer<typeof productListQuerySchema>;

/** Row-level inline "Save changes" on the product list (docs/09 §5.2: "Inline editing of price and stock directly in the row"). */
export const quickPriceUpdateSchema = z
  .object({
    variantId: z.string().min(1),
    pricePaisa: paisaSchema.refine((value) => value > 0, "Enter a price."),
    compareAtPricePaisa: paisaSchema.optional(),
  })
  .refine(
    (value) =>
      value.compareAtPricePaisa === undefined || value.compareAtPricePaisa > value.pricePaisa,
    {
      message: "The offer price needs to be lower than the normal price.",
      path: ["compareAtPricePaisa"],
    },
  );
export type QuickPriceUpdateInput = z.infer<typeof quickPriceUpdateSchema>;

/**
 * Row-level inline stock quick-edit. `reason` defaults to `CORRECTION` —
 * docs/09 §6's "Set…" dialog normally forces an explicit reason choice,
 * but a bare inline table cell has no room for that dialog; "Correction"
 * (the vocabulary-table term for a manual adjustment with no other
 * specific cause) is the honest default for "I just typed a new number
 * in a table," not a way around the "no change without a reason" rule —
 * `StockMovement.reason` is still always written, just with this fixed
 * value rather than a per-edit prompt. See `server/services/admin/
 * stock.ts`'s header comment for the fuller quick-edit-vs-dialog scope
 * note.
 */
export const quickStockUpdateSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.number().int().min(0, "Enter how many you have."),
  reason: z.nativeEnum(StockMovementReason).default(StockMovementReason.CORRECTION),
  note: z.string().trim().max(300).optional(),
});
export type QuickStockUpdateInput = z.infer<typeof quickStockUpdateSchema>;
