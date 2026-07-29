/**
 * docs/11-SEO-STRATEGY.md §4.2/§9.1 — `ComputerStore` (the most specific
 * applicable `LocalBusiness` subtype), emitted on `/stores/[branchSlug]`
 * and referenced (not duplicated) from `/stores`.
 *
 * `openingHoursSpecification` gotcha (exact quote): "Nepal's week starts
 * Sunday and Saturday is the weekly holiday — the
 * `openingHoursSpecification` must reflect that, not a Mon–Fri Western
 * default." This builder makes no assumption about the week at all — it
 * takes whatever `hours` rows the caller passes (one per real
 * `BranchHours` day, whichever days those are) and grows one
 * `OpeningHoursSpecification` node per closed/open day exactly as given,
 * so the actual data drives the shape rather than a hardcoded week.
 */
import { absoluteUrl } from "../site";
import type { JsonLdNode } from "./types";

const SCHEMA_DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export interface BranchHoursInput {
  /** 0 = Sunday ... 6 = Saturday, matching `BranchHours.dayOfWeek`. */
  dayOfWeek: number;
  isClosed: boolean;
  openTime?: string | null;
  closeTime?: string | null;
}

export interface ComputerStoreJsonLdInput {
  slug: string;
  name: string;
  telephone: string;
  email?: string | null;
  streetAddress: string;
  addressLocality: string;
  addressRegion?: string | null;
  postalCode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  images?: string[];
  hours: BranchHoursInput[];
}

export function buildComputerStoreJsonLd(input: ComputerStoreJsonLdInput): JsonLdNode {
  const pageUrl = absoluteUrl(`/stores/${input.slug}`, "en");

  return {
    "@type": "ComputerStore",
    "@id": `${pageUrl}#store`,
    name: input.name,
    parentOrganization: { "@id": `${absoluteUrl("/", "en")}#organization` },
    url: pageUrl,
    ...(input.images && input.images.length > 0 ? { image: input.images } : {}),
    telephone: input.telephone,
    ...(input.email ? { email: input.email } : {}),
    currenciesAccepted: "NPR",
    address: {
      "@type": "PostalAddress",
      streetAddress: input.streetAddress,
      addressLocality: input.addressLocality,
      ...(input.addressRegion ? { addressRegion: input.addressRegion } : {}),
      ...(input.postalCode ? { postalCode: input.postalCode } : {}),
      addressCountry: "NP",
    },
    ...(input.latitude != null && input.longitude != null
      ? {
          geo: {
            "@type": "GeoCoordinates",
            latitude: input.latitude,
            longitude: input.longitude,
          },
        }
      : {}),
    areaServed: { "@type": "City", name: input.addressLocality },
    openingHoursSpecification: input.hours
      .filter((h) => !h.isClosed && h.openTime && h.closeTime)
      .map((h) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: `https://schema.org/${SCHEMA_DAY_NAMES[h.dayOfWeek]}`,
        opens: h.openTime,
        closes: h.closeTime,
      })),
  };
}
