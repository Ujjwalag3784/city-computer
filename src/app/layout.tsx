import type { Metadata } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed, IBM_Plex_Mono } from "next/font/google";
import { getLocale } from "next-intl/server";
import { JsonLd } from "@/components/seo/json-ld";
import { buildOrganizationJsonLd } from "@/lib/seo/jsonld/organization";
import { buildWebsiteJsonLd } from "@/lib/seo/jsonld/website";
import { SITE_URL } from "@/lib/seo/site";
import "./globals.css";

// 2026-08-09 design direction change: swapped Geist/Inter/JetBrains Mono
// for the IBM Plex family (Condensed for display, Sans for body, Mono for
// prices/specs/labels) — approved from a self-contained preview built and
// shown to the owner first (see globals.css's header comment for the full
// palette/type rationale). IBM Plex has real technical-product heritage
// (designed by IBM for their own hardware documentation), which is why it
// reads as "datasheet," not decorative, on product specs and prices.
//
// JUDGMENT CALL, same one the previous Inter setup made: IBM Plex Sans has
// no Devanagari glyphs (that's a separate family, "IBM Plex Sans
// Devanagari," not a subset of this one). Nepali (`ne` locale) body text
// falls back to the next font in the stack (`--font-sans` in globals.css),
// same acceptable pattern as before, not a regression this change
// introduces.
const plexCondensed = IBM_Plex_Sans_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-plex-condensed",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-plex-mono",
});

/**
 * `metadataBase` — docs/11-SEO-STRATEGY.md §3.1: "set once in the root
 * layout so every relative URL resolves absolutely." Every route's own
 * `generateMetadata` still builds fully-qualified canonical/OG/hreflang
 * URLs via `lib/seo/site.ts`'s `absoluteUrl()` rather than relying on this
 * as a fallback — but Next.js also uses `metadataBase` to resolve any
 * metadata field a route *doesn't* explicitly qualify (e.g. `icons`), so
 * it belongs here regardless.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "City Computer Systems",
  description: "Genuine Products. Best Prices. Laptops, PCs, components and repairs in Kathmandu.",
};

/**
 * This is the *true* Next.js root layout (owns `<html>`/`<body>`, the only
 * place in the tree allowed to) — `src/app/[locale]/layout.tsx` nests
 * inside it and adds the `NextIntlClientProvider`. Kept separate rather
 * than merged because non-localized routes exist as siblings of
 * `[locale]/` (`/design`, `/api/*`), and Next.js's App Router requires
 * exactly one `<html>`/`<body>` pair for the whole tree — it has to live
 * here, above the `[locale]` split, not inside it.
 *
 * `getLocale()` resolves correctly even from outside the `[locale]`
 * segment: `middleware.ts`'s `next-intl` middleware sets the request-scoped
 * locale for every matched path (including this root layout's render),
 * and `src/i18n/request.ts` falls back to `routing.defaultLocale` for the
 * few paths middleware doesn't touch (`/design`, `/api/*`).
 *
 * `dir` is intentionally omitted: neither `en` nor `ne` (Devanagari) is a
 * right-to-left script, so there is no `dir="rtl"` case to branch on —
 * unlike docs/04's "locale provider, direction, hreflang" comment might
 * suggest, "direction" is a no-op for this specific locale pair.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${plexCondensed.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        {children}
        {/*
          docs/11-SEO-STRATEGY.md §4.13's coverage matrix: "All pages —
          Organization, WebSite (root layout, @graph)." Emitted once, here,
          rather than per-page, since both nodes are identical on every
          route — a page that needs to reference the Organization/WebSite
          (Product.brand's seller, BreadcrumbList's publisher, etc.) does so
          by @id, never by re-emitting these nodes itself.
        */}
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@graph": [buildOrganizationJsonLd(), buildWebsiteJsonLd()],
          }}
        />
      </body>
    </html>
  );
}
