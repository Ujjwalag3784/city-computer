"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "@/components/layout/mobile-nav";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/** Strips an optional `/ne` locale prefix so active-state matching works in both locales. */
function stripLocale(pathname: string): string {
  return pathname.replace(/^\/ne(?=\/|$)/, "") || "/";
}

function isActive(pathname: string, href: string): boolean {
  const path = stripLocale(pathname);
  return path === href || path.startsWith(`${href}/`);
}

export interface PrimaryNavProps {
  items: NavItem[];
  cta?: NavItem;
}

/**
 * The header's category row — Stitch's "Laptops · Desktops · Components …"
 * strip with the orange "BUILD A PC" call-to-action on the right. A Client
 * Component only for `usePathname()` (active state). Scrolls horizontally on
 * narrow screens instead of hiding, matching the mobile homepage mock-up.
 */
export function PrimaryNav({ items, cta }: PrimaryNavProps) {
  const pathname = usePathname() ?? "/";

  return (
    <nav aria-label="Primary" className="border-t border-outline-variant">
      <div className="mx-auto flex h-11 max-w-[1440px] items-center gap-4 px-4 sm:px-6 lg:px-12">
        <ul className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {items.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href} className="shrink-0">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 items-center rounded px-3 font-mono text-[0.75rem] tracking-[0.02em] transition-colors",
                    active ? "text-primary" : "text-on-surface-variant hover:text-on-surface",
                    focusRing,
                  )}
                >
                  {item.label}
                  {active && (
                    <span
                      aria-hidden="true"
                      className="absolute inset-x-3 bottom-0 h-px bg-primary"
                    />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>

        {cta && (
          <Link
            href={cta.href}
            className={cn(
              "hidden shrink-0 items-center gap-2 rounded border border-primary/60 px-3 py-1.5 font-mono text-label-mono-xs text-primary transition-colors hover:bg-primary hover:text-on-primary sm:inline-flex",
              focusRing,
            )}
          >
            <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
            {cta.label}
          </Link>
        )}
      </div>
    </nav>
  );
}
