import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBlogJsonLd } from "@/lib/seo/jsonld/blog-posting";
import { buildItemListJsonLd } from "@/lib/seo/jsonld/item-list";
import {
  buildCanonical,
  buildHreflangAlternates,
  buildOpenGraph,
  paginatedTitle,
} from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { listPublicPosts } from "@/server/services/content/blog";

export const revalidate = 600;

// See `/p/[productSlug]/page.tsx`'s identical constant/comment — the blog
// service has no locale awareness at all yet (`getPublicPostBySlug` takes
// no locale param), so a `/ne/blog` page is a pure English-fallback shell
// today, not a real translation.
const HAS_NE_TRANSLATION = false;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) > 0 ? Number(pageParam) : 1;
  const title = paginatedTitle("Blog — City Computer Systems", page);
  const description = "Buying guides, repair tips, and news from City Computer Systems, Kathmandu.";
  const canonical = buildCanonical("/blog", locale, { page });

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: buildHreflangAlternates("/blog", { ne: HAS_NE_TRANSLATION }),
    },
    openGraph: buildOpenGraph({ title, description, url: canonical, locale }),
  };
}

/** `/blog` — docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md route table, ISR 600s. */
export default async function BlogIndexPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { locale } = await params;
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) > 0 ? Number(pageParam) : 1;
  const result = await listPublicPosts(page);
  const pageUrl = absoluteUrl("/blog", locale);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-headline-lg text-on-surface">Blog</h1>
        <p className="text-body-md text-on-surface-variant">
          Buying guides, repair tips, and news from our team in Kathmandu.
        </p>
      </div>

      {result.items.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">
          No posts published yet — check back soon.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {result.items.map((post) => (
            <article
              key={post.slug}
              className="flex flex-col gap-2 border-b border-glass-stroke pb-6"
            >
              <Link
                href={`/blog/${post.slug}`}
                className="text-headline-sm text-on-surface hover:underline"
              >
                {post.title}
              </Link>
              <p className="text-body-sm text-on-surface-variant">
                {post.authorName}
                {post.publishedAt ? ` · ${post.publishedAt.toLocaleDateString()}` : ""} ·{" "}
                {post.readingMinutes} min read
              </p>
              {post.excerpt && (
                <p className="text-body-md text-on-surface-variant">{post.excerpt}</p>
              )}
            </article>
          ))}
        </div>
      )}

      {result.totalPages > 1 && (
        <div className="flex justify-center gap-2">
          {page > 1 && (
            <Link href={`/blog?page=${page - 1}`} className="text-body-sm text-primary underline">
              Previous
            </Link>
          )}
          <span className="text-body-sm text-on-surface-variant">
            Page {page} of {result.totalPages}
          </span>
          {page < result.totalPages && (
            <Link href={`/blog?page=${page + 1}`} className="text-body-sm text-primary underline">
              Next
            </Link>
          )}
        </div>
      )}

      <JsonLd data={buildBlogJsonLd({ locale })} />
      <JsonLd
        data={buildItemListJsonLd({
          locale,
          pageUrl,
          items: result.items.map((post) => ({ href: `/blog/${post.slug}`, name: post.title })),
          startPosition: (page - 1) * 12 + 1,
          numberOfItems: result.total,
        })}
      />
    </div>
  );
}
