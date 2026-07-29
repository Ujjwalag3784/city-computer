/**
 * docs/11-SEO-STRATEGY.md §6.5's thin-content guard table gives an exact
 * threshold for PDPs ("120 words of unique description + >= 6 spec
 * attributes + >= 2 real photos, else product ships noindex") but no
 * numeric minimum for blog posts or CMS pages — those are a different
 * page family the doc doesn't give a table row for. Rather than leave
 * blog/CMS ungated entirely, this module applies the same spirit with a
 * documented, defensible choice of our own: 150 words of real body
 * content, a widely used floor in general SEO practice for "this page has
 * enough substance to be worth a search result." This is honest,
 * flagged-as-our-own-call territory — see PROGRESS.md Phase 11.
 *
 * The acceptance bar this exists to satisfy: "No `ne` page with a pure
 * English fallback body is indexable" and, more generally, "a page with
 * insufficient content [should not be] marked indexable." Both blog posts
 * and CMS pages in this codebase are English-only today (see
 * `src/server/services/content/blog.ts` / `pages.ts` — neither takes a
 * locale parameter yet), so the practical effect right now is: an empty
 * or near-empty draft never accidentally ships indexable, in either
 * locale.
 */
import { extractPlainText } from "@/lib/tiptap/schema";

export const MIN_BLOG_POST_WORDS = 150;
export const MIN_CMS_PAGE_WORDS = 150;

/** Counts words in a Tiptap JSON document's plain-text content. Whitespace-only or empty content counts as 0, never throws on a malformed/`null` doc. */
export function countTiptapWords(doc: unknown): number {
  const text = extractPlainText(doc).trim();
  if (text.length === 0) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

/** True when a Tiptap document has at least `minWords` words of real content. */
export function hasSubstantialContent(doc: unknown, minWords: number): boolean {
  return countTiptapWords(doc) >= minWords;
}

export function isBlogPostIndexable(doc: unknown): boolean {
  return hasSubstantialContent(doc, MIN_BLOG_POST_WORDS);
}

export function isCmsPageIndexable(doc: unknown): boolean {
  return hasSubstantialContent(doc, MIN_CMS_PAGE_WORDS);
}
