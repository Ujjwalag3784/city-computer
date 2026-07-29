import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/errors";
import { getPublicPageBySlug } from "@/server/services/content/pages";
import { TiptapContent } from "@/lib/tiptap/render";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

interface CmsPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CmsPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const page = await getPublicPageBySlug(slug);
    return {
      title: page.metaTitle ?? `${page.title} — City Computer Systems`,
      description: page.metaDescription ?? undefined,
    };
  } catch {
    return {};
  }
}

/**
 * `/pages/[slug]` — docs/02's route table (ISR 3600s). `template`
 * (docs/06 §8: `DEFAULT|FULL_WIDTH|POLICY|LANDING`) controls layout width
 * only — every template renders through the same `TiptapContent`
 * server-side renderer, never `dangerouslySetInnerHTML`.
 */
export default async function CmsPage({ params }: CmsPageProps) {
  const { slug } = await params;

  let page: Awaited<ReturnType<typeof getPublicPageBySlug>>;
  try {
    page = await getPublicPageBySlug(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const maxWidth = page.template === "FULL_WIDTH" ? "max-w-[1280px]" : "max-w-[760px]";
  const padding = page.template === "LANDING" ? "" : "p-4 sm:p-8";

  return (
    <article className={cn("mx-auto flex flex-col gap-8", maxWidth, padding)}>
      <h1 className="text-display-sm text-on-surface">{page.title}</h1>
      <TiptapContent doc={page.content} />
    </article>
  );
}
