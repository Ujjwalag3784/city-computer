import "server-only";
import { Locale } from "@/generated/prisma/client";

/**
 * Shared translation-resolution helper for every catalog service —
 * `Category`, `Brand`, and `Product` all follow the same sidecar
 * `*Translation(parentId, locale)` pattern (docs/06-DATA-MODEL.md §1: "No
 * JSON blobs for translatable text — they cannot be indexed or queried").
 *
 * Resolution order: exact locale match → English → the caller's literal
 * fallback (usually the entity's own immutable `slug`, which always
 * exists regardless of translation coverage). A product or category
 * should never render blank text just because a Nepali translation
 * hasn't been authored yet — see PROGRESS.md's note that no storefront
 * content has Nepali translations seeded today.
 */
export function resolveTranslated<T extends { locale: Locale }, K extends keyof T>(
  translations: readonly T[],
  locale: Locale,
  field: K,
  fallback: T[K],
): T[K] {
  const exact = translations.find((translation) => translation.locale === locale);
  // `field` is a `keyof T` generic, not user input — there is no attacker-
  // controlled string reaching this property access, but the security
  // linter's heuristic can't see that generics close the set of possible
  // keys at compile time.
  // eslint-disable-next-line security/detect-object-injection
  if (exact != null && exact[field] != null) return exact[field];

  if (locale !== Locale.EN) {
    const english = translations.find((translation) => translation.locale === Locale.EN);
    // eslint-disable-next-line security/detect-object-injection
    if (english != null && english[field] != null) return english[field];
  }

  return fallback;
}

/** Shared pagination-meta shape (docs/07 §2's list envelope) across `listProducts` and `searchProducts`. Offset pagination only in this pass — cursor pagination (docs/07 §2's other supported style) is not implemented, so `nextCursor` is always `null`. */
export interface PaginationMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  nextCursor: string | null;
}

export function buildPaginationMeta(page: number, perPage: number, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return {
    page,
    perPage,
    total,
    totalPages,
    hasNext: page < totalPages,
    nextCursor: null,
  };
}
