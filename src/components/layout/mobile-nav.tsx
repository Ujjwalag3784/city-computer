"use client";

import Link from "next/link";
import { Menu, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * MobileNav — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "**`MobileNav`**" (bold = not present in the Stitch designs, designed
 * from scratch here). Built on the `Sheet` primitive
 * (`@/components/ui/sheet`), which is itself documented as a slide-in
 * `Dialog` — this stays a thin composition on top of that, not a second
 * dialog implementation.
 *
 * `MobileNav` owns both the hamburger trigger and the sheet body, so
 * `SiteHeader` only ever renders `<MobileNav navItems={...} />` — there is
 * exactly one place the trigger and its panel could drift out of sync.
 *
 * Must be a Client Component: it renders Radix's `Dialog`-backed `Sheet`,
 * which needs the browser to manage open/closed state. `usePathname` /
 * other `next/navigation` hooks are deliberately not used here — there is
 * no App Router page structure beyond `/` yet, so links are plain and
 * unstyled-for-active-state until routing exists.
 *
 * Accessibility: the trigger is icon-only, so it carries an explicit
 * `aria-label` and a 44×44 hit target via `Button`'s `iconOnly` prop
 * (docs/05-DESIGN-SYSTEM.md §5 A2, A9). `SheetTitle` supplies the
 * accessible name Radix's `Dialog.Title` requires (§5 A11 is the
 * skip-link; this is the analogous "every dialog needs a name" rule) even
 * though it is styled small and understated here. Every row in the nav
 * list is at least 44px tall (`min-h-11`) per §5 A9.
 */

export interface NavItem {
  label: string;
  href: string;
}

/**
 * Shared primary nav taxonomy. Exported so `SiteHeader` imports the same
 * array instead of duplicating it — the desktop nav and this sheet must
 * never drift apart (docs/05-DESIGN-SYSTEM.md §10 gate: "Mobile nav works;
 * nav height uniform").
 */
export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { label: "Laptops", href: "/c/laptops" },
  { label: "Desktops", href: "/c/desktops" },
  { label: "Components", href: "/c/components" },
  { label: "Peripherals", href: "/c/peripherals" },
  { label: "Monitors", href: "/c/monitors" },
  { label: "Gaming", href: "/c/gaming" },
  { label: "PC Builder", href: "/build/new" },
  { label: "Deals", href: "/shop?sort=-discount&onSale=true" },
];

const SECONDARY_NAV_ITEMS: NavItem[] = [
  { label: "Account", href: "/account" },
  { label: "Wishlist", href: "/account/wishlist" },
  { label: "Track your order", href: "/track" },
];

const navRowClasses = cn(
  "flex min-h-11 items-center rounded px-3 text-body-md text-on-surface transition-colors",
  "hover:bg-surface-container-high",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container",
);

const secondaryRowClasses = cn(
  "flex min-h-11 items-center rounded px-3 text-body-md text-on-surface-variant transition-colors",
  "hover:bg-surface-container-high hover:text-on-surface",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container",
);

export interface MobileNavProps {
  /** Primary nav taxonomy, shared with the desktop nav. Defaults to `DEFAULT_NAV_ITEMS`. */
  navItems?: NavItem[];
}

export function MobileNav({ navItems = DEFAULT_NAV_ITEMS }: MobileNavProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="md" iconOnly aria-label="Open menu">
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left">
        <SheetHeader>
          <SheetTitle className="text-body-sm text-on-surface-variant">Menu</SheetTitle>
        </SheetHeader>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" />
          <Input
            type="search"
            placeholder="Search products..."
            aria-label="Search products"
            className="pl-9"
          />
        </div>

        <nav aria-label="Primary" className="flex flex-col gap-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className={navRowClasses}>
              {item.label}
            </Link>
          ))}
        </nav>

        <Separator />

        <nav aria-label="Account" className="flex flex-col gap-1">
          {SECONDARY_NAV_ITEMS.map((item) => (
            <Link key={item.href} href={item.href} className={secondaryRowClasses}>
              {item.label}
            </Link>
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
