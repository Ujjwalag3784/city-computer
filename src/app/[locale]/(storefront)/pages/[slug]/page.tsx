import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/jsonld/breadcrumb";
import type { JsonLdNode } from "@/lib/seo/jsonld/types";
import {
  buildCanonical,
  buildHreflangAlternates,
  buildOpenGraph,
  ROBOTS_NOINDEX_FOLLOW,
  robotsForTranslationState,
} from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { isCmsPageIndexable } from "@/lib/seo/thin-content";
import { NotFoundError } from "@/lib/errors";
import { getPublicPageBySlug } from "@/server/services/content/pages";
import { TiptapContent } from "@/lib/tiptap/render";
import { cn } from "@/lib/utils";

export const revalidate = 3600;

// See `/blog/page.tsx`'s identical constant/comment — `pages.ts` has no
// locale awareness yet either.
const HAS_NE_TRANSLATION = false;

interface CmsPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: CmsPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const page = await getPublicPageBySlug(slug);
    const pathname = `/pages/${slug}`;
    const title = page.metaTitle ?? `${page.title} — City Computer Systems`;
    const description = page.metaDescription ?? undefined;
    const canonical = buildCanonical(pathname, locale);
    const indexableContent = isCmsPageIndexable(page.content);

    return {
      title,
      description,
      alternates: {
        canonical,
        languages: buildHreflangAlternates(pathname, { ne: HAS_NE_TRANSLATION }),
      },
      robots: indexableContent
        ? robotsForTranslationState(locale, HAS_NE_TRANSLATION)
        : ROBOTS_NOINDEX_FOLLOW,
      openGraph: buildOpenGraph({ title, description, url: canonical, locale }),
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
  const { locale, slug } = await params;

  let page: Awaited<ReturnType<typeof getPublicPageBySlug>>;
  try {
    page = await getPublicPageBySlug(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const maxWidth = page.template === "FULL_WIDTH" ? "max-w-[1280px]" : "max-w-[760px]";
  const padding = page.template === "LANDING" ? "" : "p-4 sm:p-8";
  const pageUrl = absoluteUrl(`/pages/${slug}`, locale);
  const breadcrumbItems = [{ label: page.title }];
  const webPage: JsonLdNode = {
    "@type": "WebPage",
    "@id": pageUrl,
    url: pageUrl,
    name: page.title,
    inLanguage: locale,
    isPartOf: { "@id": `${absoluteUrl("/", "en")}#website` },
  };

  return (
    <article className={cn("mx-auto flex flex-col gap-8", maxWidth, padding)}>
      <Breadcrumbs items={breadcrumbItems} />
      <h1 className="text-display-sm text-on-surface">{page.title}</h1>
      <TiptapContent doc={page.content} />

      <JsonLd data={buildBreadcrumbListJsonLd(breadcrumbItems, locale, { pageUrl })} />
      <JsonLd data={webPage} />
    </article>
  );
}
