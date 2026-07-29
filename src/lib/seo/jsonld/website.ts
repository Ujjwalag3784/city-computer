/** docs/11-SEO-STRATEGY.md §4.3 — WebSite + SearchAction, emitted site-wide in the root layout. */
import { SITE_NAME, absoluteUrl } from "../site";
import type { JsonLdNode } from "./types";

export function buildWebsiteJsonLd(): JsonLdNode {
  const home = absoluteUrl("/", "en");
  return {
    "@type": "WebSite",
    "@id": `${home}#website`,
    url: home,
    name: SITE_NAME,
    publisher: { "@id": `${home}#organization` },
    inLanguage: ["en", "ne"],
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${home}search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}
