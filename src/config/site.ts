/**
 * docs/04-REPOSITORY-STRUCTURE.md: `config/site.ts` — "name, urls, socials,
 * contact." A single, typed source for the handful of facts that would
 * otherwise get hand-typed into a dozen components (footer, JSON-LD
 * `Organization` node, metadata templates, contact page).
 *
 * Placeholder values below (`SHOP_PHONE_E164`, social URLs) are the same
 * placeholders `site-footer.tsx`/`site-header.tsx` already used inline —
 * collected here so there's exactly one place to put the real numbers
 * once they exist, not scattered across components.
 */
export const siteConfig = {
  name: "City Computer",
  legalName: "City Computer Systems",
  url: "https://citycomputer.com.np",
  description: "Genuine products, best prices. Laptops, PCs, components and repairs in Kathmandu.",
  /** E.164 — placeholder until the real shop line is confirmed. */
  phone: "+9779800000000",
  email: "support@citycomputer.com.np",
  address: {
    locality: "Kathmandu",
    region: "Bagmati",
    country: "NP",
  },
  social: {
    facebook: "https://facebook.com/citycomputer",
    instagram: "https://instagram.com/citycomputer",
    youtube: "https://youtube.com/@citycomputer",
  },
} as const;

export type SiteConfig = typeof siteConfig;
