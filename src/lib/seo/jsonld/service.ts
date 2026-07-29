/**
 * docs/11-SEO-STRATEGY.md §4.10 — Service (repairs), emitted on `/service`.
 *
 * "Booking-price gotcha" (exact quote): "Only publish repair prices in
 * markup if they are also visible and honoured; otherwise omit price and
 * state 'free diagnosis, quote after inspection'." This codebase's repair
 * booking flow (Phase 10) doesn't publish fixed repair prices anywhere —
 * pricing is quoted per-job after inspection — so `priceSpecification` is
 * intentionally not a parameter this builder accepts at all; there is no
 * parameter combination that could fabricate a price this app doesn't
 * actually publish.
 */
import { absoluteUrl } from "../site";
import type { JsonLdNode } from "./types";

export interface ServiceJsonLdInput {
  areaServedCity: string;
  storeIds: string[];
}

export function buildServiceJsonLd(input: ServiceJsonLdInput): JsonLdNode {
  const pageUrl = absoluteUrl("/service", "en");
  return {
    "@type": "Service",
    "@id": `${pageUrl}#service`,
    serviceType: "Computer and laptop repair",
    name: "City Computer Systems repair service",
    provider: { "@id": `${absoluteUrl("/", "en")}#organization` },
    areaServed: { "@type": "City", name: input.areaServedCity },
    availableChannel: {
      "@type": "ServiceChannel",
      serviceUrl: absoluteUrl("/service/book", "en"),
      servicePhone: { "@type": "ContactPoint", contactType: "customer service" },
      ...(input.storeIds.length > 0
        ? { serviceLocation: input.storeIds.map((id) => ({ "@id": id })) }
        : {}),
    },
    // No `hasOfferCatalog`/`priceSpecification` — see the doc comment above
    // on why this app never fabricates a repair price in markup.
    description:
      "Free diagnosis, quote after inspection. Book a repair online or bring your device in.",
  };
}
