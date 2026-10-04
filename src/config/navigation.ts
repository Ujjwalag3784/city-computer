import type { NavItem } from "@/components/layout/mobile-nav";

/**
 * docs/04-REPOSITORY-STRUCTURE.md: `config/navigation.ts` — "fallback nav
 * if DB unavailable." The real primary nav is meant to be admin-editable
 * (docs/06's `Menu`/`MenuItem` content model); until that is wired to the
 * header, this static list is the nav.
 *
 * Every href is a real route: category slugs match `prisma/seed/taxonomy.ts`
 * exactly. (The previous list linked "Prebuilt PCs" to `/prebuilt`, which
 * never existed.)
 */
export const PRIMARY_NAV_ITEMS: NavItem[] = [
  { label: "Laptops", href: "/c/laptops" },
  { label: "Desktops", href: "/c/desktops-prebuilts" },
  { label: "Components", href: "/c/components" },
  { label: "Monitors", href: "/c/monitors" },
  { label: "Peripherals", href: "/c/peripherals" },
  { label: "Networking", href: "/c/networking" },
  { label: "Apple", href: "/c/apple-mac" },
  { label: "Repairs", href: "/service" },
];

/** The header's separate call-to-action, styled apart from the category links. */
export const BUILD_NAV_ITEM: NavItem = { label: "Build a PC", href: "/build/new" };
