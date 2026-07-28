import { defineRouting } from "next-intl/routing";

/**
 * docs/04-REPOSITORY-STRUCTURE.md's route tree comment: "`[locale]/`
 * next-intl; en unprefixed via middleware" — `localePrefix: "as-needed"`
 * is exactly that: English (the `defaultLocale`) serves at `/c/laptops`
 * with no prefix, Nepali serves at `/ne/c/laptops`.
 *
 * Version note: neither `docs/03-TECHNOLOGY-STACK.md` nor any other doc
 * pins a next-intl version — it's referenced by name in docs 02/04/11/18
 * but never version-locked. Installed `next-intl@4.13.4` (current stable
 * for Next 15 App Router at the time this was written) and built this
 * file against its `next-intl/routing` API (`defineRouting`), which is
 * the v3.22+/v4 pattern this repo structure's own `src/i18n/routing.ts`
 * naming already implies.
 */
export const routing = defineRouting({
  locales: ["en", "ne"],
  defaultLocale: "en",
  localePrefix: "as-needed",
});
