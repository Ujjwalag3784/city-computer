import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBreadcrumbListJsonLd } from "@/lib/seo/jsonld/breadcrumb";
import { buildComputerStoreJsonLd } from "@/lib/seo/jsonld/local-business";
import { buildCanonical, buildHreflangAlternates, buildOpenGraph } from "@/lib/seo/metadata";
import { absoluteUrl } from "@/lib/seo/site";
import { NotFoundError } from "@/lib/errors";
import { getActiveBranchBySlug } from "@/server/services/content/stores";

export const revalidate = 3600;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// See `/blog/page.tsx`'s identical constant/comment — `Branch` has no
// locale-specific content path yet.
const HAS_NE_TRANSLATION = false;

interface StorePageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { locale, slug } = await params;
  try {
    const branch = await getActiveBranchBySlug(slug);
    const pathname = `/stores/${slug}`;
    const title = branch.metaTitle ?? `${branch.name} — City Computer Systems`;
    const description =
      branch.metaDescription ?? `Visit our ${branch.name} store at ${branch.addressLine}.`;
    const canonical = buildCanonical(pathname, locale);
    return {
      title,
      description,
      alternates: {
        canonical,
        languages: buildHreflangAlternates(pathname, { ne: HAS_NE_TRANSLATION }),
      },
      openGraph: buildOpenGraph({ title, description, url: canonical, locale }),
    };
  } catch {
    return {};
  }
}

/** `/stores/[slug]` — docs/02's route table: "ISR 3600s, LocalBusiness schema." JSON-LD via the shared `buildComputerStoreJsonLd` builder (docs/11 §4.2) rather than `ElectronicsStore` — `ComputerStore` is the more specific applicable subtype the doc names. */
export default async function StorePage({ params }: StorePageProps) {
  const { locale, slug } = await params;

  let branch: Awaited<ReturnType<typeof getActiveBranchBySlug>>;
  try {
    branch = await getActiveBranchBySlug(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const pageUrl = absoluteUrl(`/stores/${slug}`, locale);
  const breadcrumbItems = [{ label: "Stores", href: "/stores" }, { label: branch.name }];

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-8 p-4 sm:p-8">
      <Breadcrumbs items={breadcrumbItems} />
      <div className="flex flex-col gap-2">
        <h1 className="text-display-sm text-on-surface">{branch.name}</h1>
        <p className="text-body-md text-on-surface-variant">{branch.addressLine}</p>
        <p className="text-body-md text-on-surface-variant">{branch.district}</p>
        <p className="text-body-md text-on-surface-variant">{branch.phone}</p>
        {branch.email && <p className="text-body-md text-on-surface-variant">{branch.email}</p>}
        {branch.isPickupEnabled && (
          <p className="text-body-md text-primary">Order pickup available here</p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-headline-sm text-on-surface">Opening hours</h2>
        <table className="w-full text-body-sm">
          <tbody>
            {branch.hours.map((h) => (
              <tr key={h.dayOfWeek} className="border-b border-glass-stroke">
                <td className="py-2 text-on-surface">{DAY_NAMES[h.dayOfWeek]}</td>
                <td className="py-2 text-on-surface-variant">
                  {h.isClosed || !h.openTime || !h.closeTime
                    ? "Closed"
                    : `${h.openTime} – ${h.closeTime}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {branch.mapEmbedUrl && (
        <iframe
          src={branch.mapEmbedUrl}
          title={`Map to ${branch.name}`}
          className="h-[320px] w-full rounded-lg border border-glass-stroke"
          loading="lazy"
        />
      )}

      <JsonLd data={buildBreadcrumbListJsonLd(breadcrumbItems, locale, { pageUrl })} />
      <JsonLd
        data={buildComputerStoreJsonLd({
          slug,
          name: branch.name,
          telephone: branch.phone,
          email: branch.email,
          streetAddress: branch.addressLine,
          addressLocality: branch.district,
          latitude: branch.latitude,
          longitude: branch.longitude,
          hours: branch.hours,
        })}
      />
    </div>
  );
}
