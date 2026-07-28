import type { NavItem } from "@/components/layout/mobile-nav";

/**
 * docs/04-REPOSITORY-STRUCTURE.md: `config/navigation.ts` — "fallback nav
 * if DB unavailable." The real primary nav is meant to be admin-editable
 * (docs/06's `Menu`/`MenuItem` content model, keyed `HEADER`/
 * `FOOTER_COMPANY`/`FOOTER_CATEGORIES`/`MOBILE`) — that content service
 * doesn't exist yet (Phase 5+ admin territory), so this static list is
 * currently the *only* nav, not a fallback for one. Kept as its own file
 * now so swapping in the real DB-backed nav later means changing one
 * import in `(storefront)/layout.tsx`, not hunting down an inline array.
 */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Laptops", href: "/c/laptops" },
  { label: "Desktops & Prebuilts", href: "/c/desktops-prebuilts" },
  { label: "Components", href: "/c/components" },
  { label: "Monitors", href: "/c/monitors" },
  { label: "Peripherals", href: "/c/peripherals" },
  { label: "Build a PC", href: "/build" },
  { label: "Prebuilt PCs", href: "/prebuilt" },
];
