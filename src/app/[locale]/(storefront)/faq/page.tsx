import type { Metadata } from "next";
import { listPublicFaqs } from "@/server/services/content/faqs";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Frequently asked questions — City Computer Systems",
  description: "Answers to common questions about ordering, delivery, warranty, and repairs.",
};

/** `/faq` — docs/17 Phase 10. Real FAQPage JSON-LD, since the `Faq` model's own schema comment names this as its purpose. */
export default async function FaqPage() {
  const faqs = await listPublicFaqs();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-8 p-4 sm:p-8">
      <h1 className="text-display-sm text-on-surface">Frequently asked questions</h1>

      {faqs.length === 0 ? (
        <p className="text-body-md text-on-surface-variant">No questions published yet.</p>
      ) : (
        <div className="flex flex-col gap-6">
          {faqs.map((faq) => (
            <div
              key={faq.question}
              className="flex flex-col gap-1 border-b border-glass-stroke pb-6"
            >
              <h2 className="text-headline-sm text-on-surface">{faq.question}</h2>
              <p className="text-body-md text-on-surface-variant">{faq.answer}</p>
            </div>
          ))}
        </div>
      )}

      {/*
        Structured-data JSON-LD as plain text children — never
        `dangerouslySetInnerHTML` (this codebase's own eslint rule bans it
        outright, docs/13-SECURITY.md §4). The `</` escape guards against an
        admin-entered FAQ answer containing a literal "</script>": a
        browser's HTML parser looks for that end-tag sequence inside a
        `<script>` element regardless of how the text got there, so this
        matters even though `question`/`answer` are plain text, not Tiptap
        rich text.
      */}
      <script type="application/ld+json">{JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
    </div>
  );
}
