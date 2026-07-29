/**
 * `/admin/blog` — docs/17 Phase 10's "Blog with categories, authors,
 * Tiptap editor, sanitised rendering, reading time, related products"
 * over the existing `Post`/`Author`/`PostCategory`/`PostTag`/`PostProduct`
 * models (docs/06-DATA-MODEL.md §8, `prisma/schema/content.prisma`).
 *
 * `content` is accepted here as `z.unknown()` — the real gate is
 * `parseTiptapDocument` (`src/lib/tiptap/schema.ts`), run by the service
 * layer, not this form-shape schema. Keeping the two separate means the
 * "no raw HTML ever accepted" rule lives in exactly one place.
 */
import { z } from "zod";
import { PostStatus } from "@/generated/prisma/client";

export const ADMIN_POST_FILTERS = ["all", "published", "draft", "scheduled", "archived"] as const;
export type AdminPostFilter = (typeof ADMIN_POST_FILTERS)[number];

export const adminPostListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  filter: z.enum(ADMIN_POST_FILTERS).default("all"),
  page: z.coerce.number().int().min(1).default(1),
});
export type AdminPostListQuery = z.infer<typeof adminPostListQuerySchema>;

export const postFormSchema = z.object({
  title: z.string().trim().min(3, "Give this post a title."),
  slug: z
    .string()
    .trim()
    .min(1, "Enter a URL slug.")
    .regex(/^[a-z0-9-]+$/, "Use only lowercase letters, numbers, and hyphens."),
  excerpt: z.string().trim().max(500).optional(),
  content: z.unknown(),
  authorId: z.string().min(1, "Choose an author."),
  status: z.nativeEnum(PostStatus).default(PostStatus.DRAFT),
  categorySlugsText: z.string().trim().optional(),
  tagsText: z.string().trim().optional(),
  relatedProductSlugsText: z.string().trim().optional(),
  coverMediaId: z.string().trim().optional(),
  metaTitle: z.string().trim().max(200).optional(),
  metaDescription: z.string().trim().max(300).optional(),
});
export type PostFormInput = z.infer<typeof postFormSchema>;

export const authorFormSchema = z.object({
  name: z.string().trim().min(2, "Enter this author's name."),
  bio: z.string().trim().max(1000).optional(),
});
export type AuthorFormInput = z.infer<typeof authorFormSchema>;
