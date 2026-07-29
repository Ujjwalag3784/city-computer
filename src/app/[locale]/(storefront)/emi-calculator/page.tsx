import type { Metadata } from "next";
import { getPublicEmiData } from "@/server/services/content/emi";
import { EmiCalculatorClient } from "./_components/emi-calculator-client";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "EMI calculator — City Computer Systems",
  description:
    "Estimate your monthly instalment for a laptop, desktop, or accessory purchase across our partner banks.",
};

/**
 * `/emi-calculator` — docs/10-PAYMENTS-NEPAL.md §10 implementation item 1
 * and docs/11-SEO-STRATEGY.md's route table ("static, indexable"). Real
 * bank/tenure data comes from `Setting` (`getPublicEmiData`), so the owner
 * can update rates without a deploy — see that function's own doc comment
 * for how a malformed edit degrades safely instead of 500ing this page.
 */
export default async function EmiCalculatorPage() {
  const { enabled, schedules } = await getPublicEmiData();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "City Computer Systems EMI Calculator",
    applicationCategory: "FinanceApplication",
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "NPR" },
  };

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-6 p-4 sm:p-8">
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

      {/* JSON-LD as plain text children, never `dangerouslySetInnerHTML` — see `/faq/page.tsx`'s identical comment for why. */}
      <script type="application/ld+json">{JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
    </div>
  );
}
