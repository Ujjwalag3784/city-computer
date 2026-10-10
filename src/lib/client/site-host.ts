import { siteConfig } from "@/config/site";

/**
 * The bare host the storefront is served from (e.g. "city-computer.vercel.app"),
 * for the admin's "this is where it will appear" previews and toasts. Safe in
 * Client Components: only `NEXT_PUBLIC_*` variables, which Next inlines at
 * build time. Vercel exposes its production domain as
 * `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`, so this is right on Vercel
 * even before a custom domain or `NEXT_PUBLIC_SITE_URL` is set.
 */
function resolveSiteHost(): string {
  // eslint-disable-next-line no-restricted-properties -- NEXT_PUBLIC_* are build-time inlined, client-safe
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  // eslint-disable-next-line no-restricted-properties -- see above
  const vercel = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL;
  const origin = explicit || (vercel ? `https://${vercel}` : siteConfig.url);
  return origin.replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

export const SITE_HOST = resolveSiteHost();
