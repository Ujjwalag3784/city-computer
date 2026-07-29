import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/jsonld/breadcrumb";
import { buildServiceJsonLd } from "@/lib/seo/jsonld/service";
import { buildCanonical, buildHreflangAlternates, buildOpenGraph } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";

const HAS_NE_TRANSLATION = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const title = "Repairs — City Computer Systems";
  const description =
    "Book a repair for your laptop, desktop, or other device, and track its progress online.";
  const canonical = buildCanonical("/service", locale);
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: buildHreflangAlternates("/service", { ne: HAS_NE_TRANSLATION }),
    },
    openGraph: buildOpenGraph({ title, description, url: canonical, locale }),
  };
}

/** `/service` — docs/02's route table. Landing page linking to booking + status lookup. */
export default async function ServicePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const pageUrl = absoluteUrl("/service", locale);
  const breadcrumbItems = [{ label: "Repairs" }];

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-8 p-4 sm:p-8">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm text-on-surface">Repairs</h1>
        <p className="text-body-md text-on-surface-variant">
          Bring your device in, or book online first so we know to expect you. Track any
          repair&apos;s progress with your ticket number.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/service/book">Book a repair</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/service/status">Check repair status</Link>
        </Button>
      </div>

      <JsonLd data={buildBreadcrumbListJsonLd(breadcrumbItems, locale, { pageUrl })} />
      <JsonLd data={buildServiceJsonLd({ areaServedCity: "Kathmandu", storeIds: [] })} />
    </div>
  );
}
