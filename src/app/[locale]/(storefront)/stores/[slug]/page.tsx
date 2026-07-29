import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/errors";
import { getActiveBranchBySlug } from "@/server/services/content/stores";

export const revalidate = 3600;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface StorePageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: StorePageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const branch = await getActiveBranchBySlug(slug);
    return {
      title: branch.metaTitle ?? `${branch.name} — City Computer Systems`,
      description:
        branch.metaDescription ?? `Visit our ${branch.name} store at ${branch.addressLine}.`,
    };
  } catch {
    return {};
  }
}

/** `/stores/[slug]` — docs/02's route table: "ISR 3600s, LocalBusiness schema." */
export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;

  let branch: Awaited<ReturnType<typeof getActiveBranchBySlug>>;
  try {
    branch = await getActiveBranchBySlug(slug);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ElectronicsStore",
    name: branch.name,
    address: {
      "@type": "PostalAddress",
      streetAddress: branch.addressLine,
      addressRegion: branch.district,
      addressCountry: "NP",
    },
    telephone: branch.phone,
    ...(branch.latitude != null && branch.longitude != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: branch.latitude,
            longitude: branch.longitude,
          },
        }
      : {}),
    openingHoursSpecification: branch.hours
      .filter((h) => !h.isClosed && h.openTime && h.closeTime)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${DAY_NAMES[h.dayOfWeek]}`,
        opens: h.openTime,
        closes: h.closeTime,
      })),
  };

  return (
    <div className="mx-auto flex max-w-[760px] flex-col gap-8 p-4 sm:p-8">
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

      {/* Structured-data JSON-LD as plain text children — never `dangerouslySetInnerHTML` (this codebase's own eslint rule bans it, docs/13-SECURITY.md §4). Built entirely from plain admin-authored Branch fields, never Tiptap rich text. */}
      <script type="application/ld+json">{JSON.stringify(jsonLd).replace(/</g, "\\u003c")}</script>
    </div>
  );
}
