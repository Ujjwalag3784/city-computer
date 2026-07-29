/**
 * docs/11-SEO-STRATEGY.md §4.7 — FAQPage.
 *
 * Hard rule (exact quote): "Never emit `FAQPage` on a PDP with no visible
 * Q&A, and never duplicate the same FAQ set across dozens of pages."
 * Structurally enforced the same way the zero-review rule is: this
 * builder returns `null` (not an empty `FAQPage` node) when there are no
 * questions to show, so a caller that always calls it unconditionally
 * can never accidentally ship an empty/fake FAQPage — the render call
 * site (`JsonLd`) already skips `null`/`undefined`.
 *
 * "Emitted only where a real, visible FAQ block exists" — this builder
 * takes the exact `{question, answer}[]` a page already renders visibly,
 * the same one-source-of-truth pattern `breadcrumb.ts` uses for its
 * `{label, href}[]` — there is no separate "FAQ markup content" path that
 * could drift from what a visitor actually sees.
 */
import type { JsonLdNode } from "./types";

export interface FaqEntry {
  question: string;
  answer: string;
}

export function buildFaqPageJsonLd(faqs: FaqEntry[]): JsonLdNode | null {
  if (faqs.length === 0) return null;
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}
