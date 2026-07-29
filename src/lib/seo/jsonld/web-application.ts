/**
 * docs/11-SEO-STRATEGY.md §4.13's coverage matrix names `WebApplication`
 * on `/build` (the configurator) and `/emi-calculator`, without a worked
 * example — this builder sticks to the standard `WebApplication`
 * properties schema.org itself documents (`applicationCategory`,
 * `operatingSystem`, a free `Offer` since neither tool charges anything).
 */
import { absoluteUrl } from "../site";
import type { JsonLdNode } from "./types";

export interface WebApplicationJsonLdInput {
  pathname: string;
  locale: string;
  name: string;
  description: string;
  applicationCategory: string;
}

export function buildWebApplicationJsonLd(input: WebApplicationJsonLdInput): JsonLdNode {
  const pageUrl = absoluteUrl(input.pathname, input.locale);
  return {
    "@type": "WebApplication",
    "@id": `${pageUrl}#webapplication`,
    name: input.name,
    description: input.description,
    url: pageUrl,
    applicationCategory: input.applicationCategory,
    operatingSystem: "Any",
    offers: { "@type": "Offer", price: "0", priceCurrency: "NPR" },
  };
}
