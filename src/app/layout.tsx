import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";
import { getLocale } from "next-intl/server";
import { JsonLd } from "@/components/seo/json-ld";
import { buildOrganizationJsonLd } from "@/lib/seo/jsonld/organization";
import { buildWebsiteJsonLd } from "@/lib/seo/jsonld/website";
import { SITE_URL } from "@/lib/seo/site";
import "./globals.css";

// 2026-10-04 "Obsidian Kinetic" redesign (owner's Google Stitch export):
// Manrope for display/headlines, Inter for body, JetBrains Mono for specs,
// SKUs and labels — see globals.css's header.
//
// Self-hosted variable fonts (src/app/fonts/README.md), not
// `next/font/google`: Google intermittently serves a font URL that crashes
// next/font's loader and fails the production build. One variable file per
// family covers every weight the design uses.
//
// None of the three ships Devanagari glyphs; Nepali (`ne`) text falls back
// to the next font in each stack, the same accepted pattern as before.
const manrope = localFont({
  src: "./fonts/manrope-latin-wght.woff2",
  weight: "200 800",
  display: "swap",
  variable: "--font-manrope",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const inter = localFont({
  src: "./fonts/inter-latin-wght.woff2",
  weight: "100 900",
  display: "swap",
  variable: "--font-inter",
  fallback: ["ui-sans-serif", "system-ui", "sans-serif"],
});

const jetbrainsMono = localFont({
  src: "./fonts/jetbrains-mono-latin-wght.woff2",
  weight: "100 800",
  display: "swap",
  variable: "--font-jetbrains-mono",
  fallback: ["ui-monospace", "monospace"],
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
      className={`${manrope.variable} ${inter.variable} ${jetbrainsMono.variable}`}
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
