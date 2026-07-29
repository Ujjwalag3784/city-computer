import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { NotFoundError } from "@/lib/errors";
import { getPublicPostBySlug } from "@/server/services/content/blog";
import { TiptapContent } from "@/lib/tiptap/render";
import { ProductGrid } from "@/components/commerce/product-grid";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/jsonld/breadcrumb";
import { buildBlogPostingJsonLd } from "@/lib/seo/jsonld/blog-posting";
import {
  buildCanonical,
  buildHreflangAlternates,
  buildOpenGraph,
  ROBOTS_NOINDEX_FOLLOW,
  robotsForTranslationState,
} from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { isBlogPostIndexable } from "@/lib/seo/thin-content";
import { toProductCardData } from "../../_lib/catalog-view";

export const revalidate = 600;

// See `/p/[productSlug]/page.tsx`'s identical constant/comment — the blog
// service has no locale awareness at all yet.
const HAS_NE_TRANSLATION = false;

interface BlogPostPageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const post = await getPublicPostBySlug(slug);
    const pathname = `/blog/${slug}`;
    const title = post.metaTitle ?? `${post.title} — City Computer Systems`;
    const description = post.metaDescription ?? post.excerpt ?? undefined;
    const canonical = buildCanonical(pathname, locale);
    const indexableContent = isBlogPostIndexable(post.content);

    return {
      title,
      description,
      alternates: {
        canonical,
        languages: buildHreflangAlternates(pathname, { ne: HAS_NE_TRANSLATION }),
      },
      // A thin/near-empty draft never ships indexable, regardless of
      // translation state — docs/11 §6.5's thin-content guard, applied to
      // blog posts per this codebase's own extension of it (thin-
      // content.ts's doc comment).
      robots: indexableContent
        ? robotsForTranslationState(locale, HAS_NE_TRANSLATION)
        : ROBOTS_NOINDEX_FOLLOW,
      // `type: "article"` is correct here — it's the one page type in
      // this codebase that's actually meant to carry it. docs/11 §12's
      // acceptance bar bans `article` only on a PDP.
      openGraph: buildOpenGraph({
        title,
        description,
        url: canonical,
        locale,
        type: "article",
      }),
    };
  } catch {
    return {};
  }
}

/**
 * `/blog/[slug]` — docs/17 Phase 10: "sanitised rendering, reading time,
 * related products." Renders server-side via `TiptapContent`
 * (`src/lib/tiptap/render.tsx`) — never `dangerouslySetInnerHTML`. Fully
 * indexable: no client-only data fetching, real `<h1>`/metadata.
 */
export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { locale, slug } = await params;

  let post: Awaited<ReturnType<typeof getPublicPostBySlug>>;
  try {
    post = await getPublicPostBySlug(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const pageUrl = absoluteUrl(`/blog/${slug}`, locale);
  // `publishedAt` doubles as `dateModified` for now — `PublicPostDetail`
  // doesn't expose `Post.updatedAt` yet, and inventing a fake "modified"
  // date would risk the exact freshness-spam pattern docs/11 §4.8 warns
  // against. Wiring the real `updatedAt` through is a small follow-up.
  const publishedIso = (post.publishedAt ?? new Date()).toISOString();
  const breadcrumbItems = [{ label: "Blog", href: "/blog" }, { label: post.title }];

  return (
    <article className="mx-auto flex max-w-[760px] flex-col gap-8 p-4 sm:p-8">
      <Breadcrumbs items={breadcrumbItems} />
      <header className="flex flex-col gap-3">
        <h1 className="text-display-sm text-on-surface">{post.title}</h1>
        <p className="text-body-sm text-on-surface-variant">
          {post.authorName}
          {post.publishedAt ? ` · ${post.publishedAt.toLocaleDateString()}` : ""} ·{" "}
          {post.readingMinutes} min read
        </p>
        {post.categorySlugs.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.categorySlugs.map((slugValue) => (
              <Link
                key={slugValue}
                href={`/blog/category/${slugValue}`}
                className="rounded-full bg-surface-container px-3 py-1 text-body-sm text-on-surface-variant hover:bg-surface-container-high"
              >
                {slugValue.replace(/-/g, " ")}
              </Link>
            ))}
          </div>
        )}
      </header>

      <TiptapContent doc={post.content} />

      {post.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-glass-stroke pt-4">
          {post.tags.map((tag) => (
            <span key={tag} className="text-body-sm text-on-surface-variant">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {post.authorBio && (
        <div className="rounded-lg border border-glass-stroke p-4">
          <p className="text-body-sm font-medium text-on-surface">About {post.authorName}</p>
          <p className="text-body-sm text-on-surface-variant">{post.authorBio}</p>
        </div>
      )}

      {post.relatedProducts.length > 0 && (
        <section aria-labelledby="related-products-heading" className="flex flex-col gap-4">
          <h2 id="related-products-heading" className="text-headline-sm text-on-surface">
            Related products
          </h2>
          <ProductGrid products={post.relatedProducts.map(toProductCardData)} />
        </section>
      )}

      <JsonLd data={buildBreadcrumbListJsonLd(breadcrumbItems, locale, { pageUrl })} />
      <JsonLd
        data={buildBlogPostingJsonLd({
          slug,
          locale,
          headline: post.title,
          description: post.excerpt ?? post.title,
          images: [],
          datePublished: publishedIso,
          dateModified: publishedIso,
          authorName: post.authorName,
        })}
      />
    </article>
  );
}
