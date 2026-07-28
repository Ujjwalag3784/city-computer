import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "@/i18n/routing";

/**
 * Called once per request (server-side) to resolve which locale's
 * messages to load. `requestLocale` reflects the `[locale]` segment
 * `middleware.ts`'s locale rewrite already resolved — this just guards
 * against an invalid/missing value (docs/04's own note: the `[locale]`
 * segment technically catches unknown routes too, e.g. `/unknown.txt`)
 * by falling back to `routing.defaultLocale` rather than throwing.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
