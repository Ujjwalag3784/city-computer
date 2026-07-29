import type { Metadata } from "next";
import Link from "next/link";
import { buildCanonical, buildHreflangAlternates } from "@/lib/seo/metadata";
import { listPublicPosts } from "@/server/services/content/blog";

export const revalidate = 600;

// See `/blog/page.tsx`'s identical constant/comment.
const HAS_NE_TRANSLATION = false;

interface CategoryBlogPageProps {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({
  params,
  searchParams,
}: CategoryBlogPageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) > 0 ? Number(pageParam) : 1;
  const pathname = `/blog/category/${slug}`;
  return {
    title: `${slug.replace(/-/g, " ")} articles — Blog — City Computer Systems`,
    alternates: {
      canonical: buildCanonical(pathname, locale, { page }),
      languages: buildHreflangAlternates(pathname, { ne: HAS_NE_TRANSLATION }),
    },
  };
}

/** `/blog/category/[slug]` — posts tagged against a real catalogue `Category` (docs/06 §8: `PostCategory` join, no standalone `BlogCategory` model). */
export default async function CategoryBlogPage({ params, searchParams }: CategoryBlogPageProps) {
  const { slug } = await params;
  const { page: pageParam } = await searchParams;
  const page = Number(pageParam) > 0 ? Number(pageParam) : 1;
  const result = await listPublicPosts(page, slug);

  return (
    <div className="mx-auto flex max-w-[900px] flex-col gap-8 p-4 sm:p-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-headline-lg text-on-surface">Articles: {slug.replace(/-/g, " ")}</h1>
        <Link href="/blog" className="text-body-sm text-primary underline">
          All blog posts
        </Link>
      </div>

      {result.items.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No posts in this category yet.</p>
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
    </div>
  );
}
