/**
 * Shared SEO site constants and absolute-URL helpers — docs/11-SEO-STRATEGY.md
 * §2.4 ("canonical tag ... always self-referencing and absolute"), §3.1
 * ("`metadataBase` is set once in the root layout so every relative URL
 * resolves absolutely").
 *
 * `env.NEXT_PUBLIC_SITE_URL` is the single source of truth for the origin —
 * never hardcode `citycomputer.com.np` in a route file. The doc's own
 * example URLs use that production hostname; this module is what makes the
 * same code produce `http://localhost:3000/...` locally and the real
 * domain in production without any route file knowing the difference.
 */
import { env } from "@/env";
import { routing } from "@/i18n/routing";
import { STORE_EMAIL, STORE_WHATSAPP_E164 } from "@/config/store";

export const SITE_NAME = "City Computer Systems" as const;
export const SITE_NAME_SHORT = "City Computer" as const;

/** Organization details for structured data (docs/11 §4.1). Social profile URLs (`sameAs`) are still to be added. */
export const ORG_INFO = {
  legalName: "City Computer Systems",
  // The shop's real WhatsApp/phone line (config/store.ts). No email until
  // the owner sets a public one.
  telephone: STORE_WHATSAPP_E164,
  email: STORE_EMAIL,
  streetAddress: "New Road",
  addressLocality: "Kathmandu",
  addressRegion: "Bagmati",
  postalCode: "44600",
  addressCountry: "NP",
  sameAs: [] as string[],
} as const;

function siteOrigin(): string {
  // No trailing slash, per docs/11 §2.4's canonical policy.
  return env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "");
}

export const SITE_URL = siteOrigin();

/**
 * `next-intl`'s `localePrefix: "as-needed"` (src/i18n/routing.ts): the
 * default locale (`en`) serves unprefixed, every other locale is prefixed.
 * This is the one function allowed to know that rule for SEO purposes —
 * every canonical/hreflang/sitemap URL is built through it so the prefixing
 * logic can never drift between call sites.
 */
export function localePath(pathname: string, locale: string): string {
  const cleanPath = pathname === "/" ? "" : pathname.replace(/\/+$/, "");
  if (locale === routing.defaultLocale) {
    return cleanPath === "" ? "/" : cleanPath;
  }
  return `/${locale}${cleanPath}`;
}

/** Absolute, canonical-safe URL for `pathname` under `locale`. Always lowercase-host, no trailing slash (except `/` itself), matching docs/11 §2.4. */
export function absoluteUrl(pathname: string, locale: string): string {
  return `${SITE_URL}${localePath(pathname, locale)}`;
}

/** Absolute URL for a path that is already locale-agnostic (e.g. a static asset, an API route, an OG image route). */
export function absoluteAssetUrl(pathname: string): string {
  return `${SITE_URL}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}
