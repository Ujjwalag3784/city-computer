import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/errors";
import { getPublicPostBySlug } from "@/server/services/content/blog";
import { TiptapContent } from "@/lib/tiptap/render";
import { ProductGrid } from "@/components/commerce/product-grid";
import { toProductCardData } from "../../_lib/catalog-view";

export const revalidate = 600;

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const post = await getPublicPostBySlug(slug);
    return {
      title: post.metaTitle ?? `${post.title} — City Computer Systems`,
      description: post.metaDescription ?? post.excerpt ?? undefined,
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
  const { slug } = await params;

  let post: Awaited<ReturnType<typeof getPublicPostBySlug>>;
  try {
    post = await getPublicPostBySlug(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  return (
    <article className="mx-auto flex max-w-[760px] flex-col gap-8 p-4 sm:p-8">
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
    </article>
  );
}
