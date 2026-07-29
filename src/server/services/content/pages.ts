/**
 * Public CMS page read path — `/pages/[slug]` (docs/02's route table, ISR
 * 3600s). Never returns a draft/archived page.
 */
import "server-only";
import { db } from "@/server/db";
import { PageTemplate, PostStatus } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { parseTiptapDocument, type TiptapDocument } from "@/lib/tiptap/schema";

export interface PublicPageDetail {
  slug: string;
  title: string;
  content: TiptapDocument;
  template: PageTemplate;
  metaTitle: string | null;
  metaDescription: string | null;
}

export async function getPublicPageBySlug(slug: string): Promise<PublicPageDetail> {
  const page = await db.page.findFirst({
    where: { slug, status: PostStatus.PUBLISHED, deletedAt: null },
  });
  if (!page) throw new NotFoundError("Page");

  const content = parseTiptapDocument(page.content) ?? { type: "doc" as const, content: [] };

  return {
    slug: page.slug,
    title: page.title,
    content,
    template: page.template,
    metaTitle: page.metaTitle,
    metaDescription: page.metaDescription,
  };
}
