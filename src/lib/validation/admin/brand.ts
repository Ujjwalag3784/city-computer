/** `/admin/brands` Server Action input shapes — docs/09-ADMIN-DAD-MODE.md §3's "Brands" module. Brand has no `position` column (unlike `Category`), so there is deliberately no reorder schema here — see `server/services/admin/brand.ts`'s header comment. */
import { z } from "zod";
import { slugSchema } from "@/lib/validation/catalog";

const nameSchema = z.string().trim().min(1, "Enter a name.").max(120);
const descriptionSchema = z.string().trim().max(2000).optional();
const metaTitleSchema = z.string().trim().max(70).optional();
const metaDescriptionSchema = z.string().trim().max(160).optional();
/** Empty string is treated as "no website" — plain HTML `<input type="url">` forms submit `""`, not `undefined`, when a field is left blank. */
const websiteSchema = z
  .string()
  .trim()
  .max(300)
  .refine((value) => value === "" || z.string().url().safeParse(value).success, {
    message: "Enter a valid website address, e.g. https://example.com.",
  })
  .transform((value) => (value === "" ? undefined : value))
  .optional();

export const createBrandSchema = z.object({
  name: nameSchema,
  slug: slugSchema.optional(),
  description: descriptionSchema,
  website: websiteSchema,
  logoId: z.string().min(1).optional(),
  isFeatured: z.boolean().default(false),
  isActive: z.boolean().default(true),
  metaTitle: metaTitleSchema,
  metaDescription: metaDescriptionSchema,
});

export type CreateBrandInput = z.infer<typeof createBrandSchema>;

/** No `slug` — immutable after creation, same rationale as `Category`'s deferred slug editing (see `admin/category.ts`'s doc comment). */
export const updateBrandSchema = z.object({
  name: nameSchema,
  description: descriptionSchema,
  website: websiteSchema,
  logoId: z.string().min(1).optional(),
  isFeatured: z.boolean(),
  isActive: z.boolean(),
  metaTitle: metaTitleSchema,
  metaDescription: metaDescriptionSchema,
});

export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
