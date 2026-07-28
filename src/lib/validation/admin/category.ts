/**
 * `/admin/categories` Server Action input shapes — docs/09-ADMIN-DAD-
 * MODE.md §3's "Categories" module. Deliberately smaller than the
 * storefront's read-path `categoryPathSchema` (`lib/validation/catalog.ts`):
 * an admin creating/editing a category works with a plain `name` and an
 * optional `parentId`, never a materialised path string — computing
 * `path`/`depth` from `parentId` is `server/services/admin/category.ts`'s
 * job, not something the form itself constructs.
 */
import { z } from "zod";
import { slugSchema } from "@/lib/validation/catalog";

const nameSchema = z.string().trim().min(1, "Enter a name.").max(120);
const descriptionSchema = z.string().trim().max(2000).optional();
const iconNameSchema = z.string().trim().max(60).optional();
const metaTitleSchema = z.string().trim().max(70).optional();
const metaDescriptionSchema = z.string().trim().max(160).optional();

/**
 * `parentId` is only accepted on create — see the JUDGMENT CALL note on
 * `server/services/admin/category.ts`'s `updateCategory`: moving a
 * category to a different parent means recomputing `path`/`depth` for
 * every descendant, which is real, separate work this pass doesn't cover.
 * `null` means "top-level category," matching `Category.parentId`'s own
 * nullability.
 */
export const createCategorySchema = z.object({
  name: nameSchema,
  /** If omitted, `slugify(name)` (de-duplicated against existing slugs) is used. */
  slug: slugSchema.optional(),
  parentId: z.string().min(1).nullable().default(null),
  description: descriptionSchema,
  iconName: iconNameSchema,
  showInNav: z.boolean().default(true),
  showInFooter: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metaTitle: metaTitleSchema,
  metaDescription: metaDescriptionSchema,
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

/** No `slug` or `parentId` — both deferred (see the module doc comment above and `updateCategory`'s own comment). */
export const updateCategorySchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  iconName: iconNameSchema,
  showInNav: z.boolean(),
  showInFooter: z.boolean(),
  isActive: z.boolean(),
  metaTitle: metaTitleSchema,
  metaDescription: metaDescriptionSchema,
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

/** One drag-and-drop reorder gesture: every sibling under `parentId`, in their new order. `server/services/admin/category.ts`'s `reorderCategories` rejects a set that doesn't exactly match the current sibling set, rather than silently partial-applying it. */
export const reorderCategoriesSchema = z.object({
  parentId: z.string().min(1).nullable(),
  orderedIds: z.array(z.string().min(1)).min(1),
});

export type ReorderCategoriesInput = z.infer<typeof reorderCategoriesSchema>;
