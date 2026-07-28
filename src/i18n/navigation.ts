import { createNavigation } from "next-intl/navigation";
import { routing } from "@/i18n/routing";

/**
 * Locale-aware `Link`/`redirect`/`usePathname`/`useRouter` — every
 * internal link in the storefront must import these instead of
 * `next/link`/`next/navigation` directly, or a Nepali-locale user
 * clicking an internal link would get silently bounced back to English
 * (docs/18 §"C4": "no hardcoded copy," and implicitly, no hardcoded
 * locale-unaware routing either).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
