/**
 * `/admin/pages` — docs/17 Phase 10's "CMS pages with templates" over the
 * existing `Page` model (docs/06-DATA-MODEL.md §8, `prisma/schema/
 * content.prisma`), already seeded with 8 policy pages (`prisma/seed/
 * content.ts`).
 */
import { z } from "zod";
import { PageTemplate, PostStatus } from "@/generated/prisma/client";

export const pageFormSchema = z.object({
  title: z.string().trim().min(2, "Give this page a title."),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a URL slug.")
    .regex(/^[a-z0-9-]+$/, "Use only lowercase letters, numbers, and hyphens."),
  content: z.unknown(),
  template: z.nativeEnum(PageTemplate).default(PageTemplate.DEFAULT),
  status: z.nativeEnum(PostStatus).default(PostStatus.DRAFT),
  metaTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(300).optional(),
});
export type PageFormInput = z.infer<typeof pageFormSchema>;
