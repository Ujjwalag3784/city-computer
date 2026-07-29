/**
 * docs/11-SEO-STRATEGY.md §4.8 — BlogPosting, emitted on `/blog/[slug]`.
 *
 * Two gotchas from the doc, both enforced/documented here:
 * - Timezone is always `+05:45` (Nepal Time) — the caller is expected to
 *   pass ISO datetimes already carrying that offset (this builder doesn't
 *   reformat dates, it trusts the caller the same way `product.ts` trusts
 *   `priceValidUntil`).
 * - "`dateModified` comes from `Post.updatedAt` and must only change on
 *   substantive edits — a typo-fix loop that bumps `dateModified` daily is
 *   a freshness-spam pattern." This builder has no way to enforce that
 *   itself (it's a content-authoring discipline, not a data shape); the
 *   comment is here so the call site remembers not to just pipe every
 *   `Post.updatedAt` straight through without a human editorial process
 *   behind it.
 */
import { absoluteUrl } from "../site";
import type { JsonLdNode } from "./types";

export interface BlogPostingJsonLdInput {
  slug: string;
  locale: string;
  headline: string;
  description: string;
  images: string[];
  datePublished: string;
  dateModified: string;
  authorName: string;
  authorUrl?: string | null;
  articleSection?: string | null;
}

export function buildBlogPostingJsonLd(input: BlogPostingJsonLdInput): JsonLdNode {
  const pageUrl = absoluteUrl(`/blog/${input.slug}`, input.locale);
  return {
    "@type": "BlogPosting",
    "@id": `${pageUrl}#article`,
    headline: input.headline,
    description: input.description,
    image: input.images,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    author: {
      "@type": "Person",
      name: input.authorName,
      ...(input.authorUrl ? { url: input.authorUrl } : {}),
    },
    publisher: { "@id": `${absoluteUrl("/", "en")}#organization` },
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    inLanguage: input.locale,
    ...(input.articleSection ? { articleSection: input.articleSection } : {}),
  };
}

/** `@type: "Blog"`, emitted on `/blog` alongside `ItemList` per docs/11 §4.13's coverage matrix. */
export function buildBlogJsonLd(input: { locale: string }): JsonLdNode {
  const pageUrl = absoluteUrl("/blog", input.locale);
  return {
    "@type": "Blog",
    "@id": `${pageUrl}#blog`,
    url: pageUrl,
    publisher: { "@id": `${absoluteUrl("/", "en")}#organization` },
    inLanguage: input.locale,
  };
}
