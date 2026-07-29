import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/jsonld/breadcrumb";
import { buildWebApplicationJsonLd } from "@/lib/seo/jsonld/web-application";
import { buildCanonical, buildHreflangAlternates, buildOpenGraph } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { getPublicEmiData } from "@/server/services/content/emi";
import { EmiCalculatorClient } from "./_components/emi-calculator-client";

export const revalidate = 3600;

const HAS_NE_TRANSLATION = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = "EMI calculator — City Computer Systems";
  const description =
    "Estimate your monthly instalment for a laptop, desktop, or accessory purchase across our partner banks.";
  const canonical = buildCanonical("/emi-calculator", locale);
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: buildHreflangAlternates("/emi-calculator", { ne: HAS_NE_TRANSLATION }),
    },
    openGraph: buildOpenGraph({ title, description, url: canonical, locale }),
  };
}

/**
 * `/emi-calculator` — docs/10-PAYMENTS-NEPAL.md §10 implementation item 1
 * and docs/11-SEO-STRATEGY.md's route table ("static, indexable"). Real
 * bank/tenure data comes from `Setting` (`getPublicEmiData`), so the owner
 * can update rates without a deploy — see that function's own doc comment
 * for how a malformed edit degrades safely instead of 500ing this page.
 */
export default async function EmiCalculatorPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const { enabled, schedules } = await getPublicEmiData();
  const pageUrl = absoluteUrl("/emi-calculator", locale);
  const breadcrumbItems = [{ label: "EMI calculator" }];

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 p-4 sm:p-8">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm text-on-surface">EMI calculator</h1>
        <p className="text-body-md text-on-surface-variant">
          Estimate your monthly payment across our partner banks. EMI is arranged directly with your
          bank at the time of purchase — this is not a checkout option.
        </p>
      </div>

      {enabled && schedules.length > 0 ? (
        <EmiCalculatorClient schedules={schedules} />
      ) : (
        <p className="text-body-md text-on-surface-variant">
          The EMI calculator isn&apos;t available right now — please check back later.
        </p>
      )}

      <JsonLd data={buildBreadcrumbListJsonLd(breadcrumbItems, locale, { pageUrl })} />
      <JsonLd
        data={buildWebApplicationJsonLd({
          pathname: "/emi-calculator",
          locale,
          name: "City Computer Systems EMI Calculator",
          description: "Estimate your monthly instalment across partner banks.",
          applicationCategory: "FinanceApplication",
        })}
      />
    </div>
  );
}
