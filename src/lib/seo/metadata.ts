/**
 * Metadata resolution helpers — docs/11-SEO-STRATEGY.md §3 (cascade,
 * length budgets), §2.6/§9.3 (hreflang), §6.6 (pagination).
 *
 * This is deliberately a small set of composable helpers rather than one
 * monolithic `resolveMetadata(kind, entity)` dispatcher: every entity that
 * carries SEO fields (`Product`, `Category`, `Brand`, `Post`, `Page`,
 * `Branch`) already has its own `metaTitle`/`metaDescription` columns
 * (Phase 3/4/10 — see PROGRESS.md), so "per-entity override → template
 * fallback" is just `entity.metaTitle ?? buildTitle(...)` at each call
 * site. A single generic dispatcher would need a large discriminated union
 * mirroring every route's data shape for no real benefit over that.
 */
import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { SITE_NAME, absoluteUrl } from "./site";

export const TITLE_HARD_MAX = 65;
export const DESCRIPTION_HARD_MAX = 165;

/** Collapses whitespace and strips leading/trailing `|` runs left behind by an empty template variable — docs/11 §3.3. */
export function cleanTemplateString(value: string): string {
  return value
    .replace(/\s+/g, " ")
    .replace(/(^[\s|]+)|([\s|]+$)/g, "")
    .replace(/\|\s*\|/g, "|")
    .trim();
}

/** Truncates at a word boundary, never mid-word, never appending `…` in `<title>` (docs/11 §3.3). */
export function truncateAtWordBoundary(value: string, max: number): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  return (lastSpace > 0 ? slice.slice(0, lastSpace) : slice).trim();
}

export function buildMetaTitle(raw: string, max = TITLE_HARD_MAX): string {
  return truncateAtWordBoundary(cleanTemplateString(raw), max);
}

/** 140-160 char target, 165 hard max, clamped at a sentence/word boundary (docs/11 §3.4). */
export function clampDescription(raw: string, max = DESCRIPTION_HARD_MAX): string {
  const cleaned = cleanTemplateString(raw);
  return truncateAtWordBoundary(cleaned, max);
}

export interface CanonicalOptions {
  /** e.g. `{ page: 2 }` appends `?page=2` per docs/11 §6.6 — pagination is the one query param class that IS part of the canonical. */
  page?: number;
}

/** Self-referencing absolute canonical for `pathname` under `locale` — docs/11 §2.4. Never relative, never omitted for an indexable page. */
export function buildCanonical(
  pathname: string,
  locale: string,
  options: CanonicalOptions = {},
): string {
  const base = absoluteUrl(pathname, locale);
  if (options.page && options.page > 1) {
    return `${base}?page=${options.page}`;
  }
  return base;
}

export interface HreflangAvailability {
  /** Whether a real, non-fallback `en` body exists. Always true today (English is the source-of-truth locale) but kept explicit for symmetry. */
  en?: boolean;
  /** Whether a real, translated `ne` body exists — docs/11 §9.3: "Emitted only when the alternate is actually indexable" / "if a page has no translated body content ... do not render an empty /ne/ shell." */
  ne: boolean;
}

/**
 * Reciprocal hreflang set for `pathname` — docs/11 §2.6/§9.3. `x-default`
 * always points at the English URL (English is `defaultLocale`). The `ne`
 * entry is omitted entirely when no real Nepali translation exists, which
 * is what keeps this reciprocal: a page never claims an alternate that
 * itself wouldn't claim it back.
 */
export function buildHreflangAlternates(
  pathname: string,
  availability: HreflangAvailability,
): Record<string, string> {
  const languages: Record<string, string> = {
    en: absoluteUrl(pathname, "en"),
    "x-default": absoluteUrl(pathname, "en"),
  };
  if (availability.ne) {
    languages.ne = absoluteUrl(pathname, "ne");
  }
  return languages;
}

export type RobotsDirective = Metadata["robots"];

export const ROBOTS_INDEX_FOLLOW: RobotsDirective = { index: true, follow: true };
export const ROBOTS_NOINDEX_FOLLOW: RobotsDirective = { index: false, follow: true };
export const ROBOTS_NOINDEX_NOFOLLOW: RobotsDirective = { index: false, follow: false };

/**
 * docs/11 §9.3's hard rule, restated as code: a `ne` page whose entity has
 * no real translation is never indexable, no matter what the route's
 * default robots policy would otherwise be — it would just be an English
 * fallback body wearing Nepali chrome (§9.2's "thin duplicate" risk).
 */
export function robotsForTranslationState(
  locale: string,
  hasTranslation: boolean,
  baseline: RobotsDirective = ROBOTS_INDEX_FOLLOW,
): RobotsDirective {
  if (locale !== routing.defaultLocale && !hasTranslation) {
    return ROBOTS_NOINDEX_FOLLOW;
  }
  return baseline;
}

/** docs/11 §6.6: page 2+ appends " — Page N" to the title so SERP entries for a paginated listing are never literal duplicates. */
export function paginatedTitle(title: string, page: number): string {
  return page > 1 ? `${title} — Page ${page}` : title;
}

/** docs/11 §6.6: page 2+ description gets a "Page N of M" prefix for the same reason. */
export function paginatedDescription(
  description: string,
  page: number,
  totalPages: number,
): string {
  return page > 1 ? `Page ${page} of ${totalPages}. ${description}` : description;
}

export { SITE_NAME };

export interface OpenGraphImageInput {
  url: string;
  width?: number;
  height?: number;
  alt: string;
}

/**
 * Shared OG/Twitter block builder. `type` defaults to `"website"` — docs/11
 * §1 defect #1 / §12's acceptance bar: "`og:type` is never `article` on a
 * PDP." Nothing in this codebase ever passes `"article"` for a product
 * route; only `buildOpenGraph` for blog posts does, at that one call site.
 */
export function buildOpenGraph(input: {
  title: string;
  description?: string;
  url: string;
  locale: string;
  images?: OpenGraphImageInput[];
  type?: "website" | "article";
}): NonNullable<Metadata["openGraph"]> {
  return {
    title: input.title,
    description: input.description,
    url: input.url,
    siteName: SITE_NAME,
    locale: input.locale === "ne" ? "ne_NP" : "en_US",
    type: input.type ?? "website",
    images: input.images?.map((image) => ({
      url: image.url,
      width: image.width,
      height: image.height,
      alt: image.alt,
    })),
  };
}

export function buildTwitter(input: {
  title: string;
  description?: string;
  images?: string[];
}): NonNullable<Metadata["twitter"]> {
  return {
    card: "summary_large_image",
    title: input.title,
    description: input.description,
    images: input.images,
  };
}
