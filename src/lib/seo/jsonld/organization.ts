/** docs/11-SEO-STRATEGY.md §4.1 — Organization, emitted site-wide in the root layout. */
import { ORG_INFO, SITE_NAME, absoluteAssetUrl, absoluteUrl } from "../site";
import type { JsonLdNode } from "./types";

export function buildOrganizationJsonLd(): JsonLdNode {
  return {
    "@type": "Organization",
    "@id": `${absoluteUrl("/", "en")}#organization`,
    name: SITE_NAME,
    url: absoluteUrl("/", "en"),
    logo: {
      "@type": "ImageObject",
      url: absoluteAssetUrl("/brand/logo-512.png"),
      width: 512,
      height: 512,
    },
    telephone: ORG_INFO.telephone,
    email: ORG_INFO.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: ORG_INFO.streetAddress,
      addressLocality: ORG_INFO.addressLocality,
      addressRegion: ORG_INFO.addressRegion,
      postalCode: ORG_INFO.postalCode,
      addressCountry: ORG_INFO.addressCountry,
    },
    ...(ORG_INFO.sameAs.length > 0 ? { sameAs: ORG_INFO.sameAs } : {}),
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: ORG_INFO.telephone,
        contactType: "customer service",
        areaServed: "NP",
        availableLanguage: ["en", "ne"],
      },
    ],
  };
}
