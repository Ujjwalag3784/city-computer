import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/jsonld/breadcrumb";
import { buildFaqPageJsonLd } from "@/lib/seo/jsonld/faq";
import { buildCanonical, buildHreflangAlternates } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { listPublicFaqs } from "@/server/services/content/faqs";

export const revalidate = 3600;

// The FAQ page's chrome is real bilingual UI copy today, but the actual
// FAQ content itself (`listPublicFaqs()`) has no locale field — see
// PROGRESS.md Phase 11.
const HAS_NE_TRANSLATION = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const canonical = buildCanonical("/faq", locale);
  return {
    title: "Frequently asked questions — City Computer Systems",
    description: "Answers to common questions about ordering, delivery, warranty, and repairs.",
    alternates: {
      canonical,
      languages: buildHreflangAlternates("/faq", { ne: HAS_NE_TRANSLATION }),
    },
  };
}

/** `/faq` — docs/17 Phase 10. FAQPage JSON-LD via the shared `lib/seo/jsonld/faq.ts` builder, since the `Faq` model's own schema comment names this as its purpose. */
export default async function FaqPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const faqs = await listPublicFaqs();
  const pageUrl = absoluteUrl("/faq", locale);
  const breadcrumbItems = [{ label: "FAQ" }];

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-8 p-4 sm:p-8">
      <Breadcrumbs items={breadcrumbItems} />
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

      <JsonLd data={buildBreadcrumbListJsonLd(breadcrumbItems, locale, { pageUrl })} />
      <JsonLd data={buildFaqPageJsonLd(faqs)} />
    </div>
  );
}
