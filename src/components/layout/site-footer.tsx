"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { formatNepalPhoneForDisplay } from "@/lib/nepal";
import { cn } from "@/lib/utils";

/**
 * SiteFooter — docs/05-DESIGN-SYSTEM.md §6 component inventory: "`SiteFooter`
 * (one, unified)". The Stitch exports shipped several conflicting/duplicate
 * footers (docs/01-DISCOVERY-AND-AUDIT.md); this is the single canonical
 * replacement meant to be used everywhere in the storefront. Which pages
 * mount it (e.g. not checkout) is a page-composition decision left for
 * later — this component itself has no route awareness.
 *
 * Copy follows docs/05 §9: sentence case everywhere, "confident, specific,
 * no hype" voice, and the copyright year is derived from `new Date()` rather
 * than hardcoded.
 *
 * Self-contained and presentational, per the current phase of this
 * codebase:
 *  - The shop phone number is rendered via `formatNepalPhoneForDisplay` on a
 *    placeholder E.164 number (`+9779800000000`) — a real number will be
 *    wired from real store data in a later phase.
 *  - Social links (`href="#"`) are placeholders — real URLs land later.
 *  - The newsletter form has no backend yet: submitting just flips a local
 *    `submitted` flag and swaps the form for a thank-you message. Wiring a
 *    real API route is a later phase (see the `handleNewsletterSubmit`
 *    comment below).
 *
 * Client Component: the newsletter form needs local state and the "Cookie
 * settings" control needs an `onClick` — both require a client boundary, so
 * the whole file is marked `"use client"` rather than splitting off nested
 * client islands for what is a non-performance-critical region.
 *
 * "Cookie settings" contract: this is a plain `<button>`, not a navigation
 * link, styled identically to the other footer links. Clicking it dispatches
 * `window.dispatchEvent(new Event("citycomputer:open-cookie-settings"))` —
 * the exact event name `CookieConsent` (`src/components/layout/
 * cookie-consent.tsx`) listens for on `window` to force its banner back
 * open regardless of any previously stored consent (docs/12-ANALYTICS-
 * MARKETING.md §11 "Withdrawal": "a permanent 'Cookie settings' link in the
 * footer"). These are the only two places in the codebase that touch this
 * event name, and the string must stay byte-identical between them.
 */
export interface SiteFooterProps {
  className?: string;
}

/** Placeholder shop contact number — real store data lands in a later phase. */
const SHOP_PHONE_E164 = "+9779800000000";

/** Must match the listener in `src/components/layout/cookie-consent.tsx` exactly. */
const OPEN_COOKIE_SETTINGS_EVENT = "citycomputer:open-cookie-settings";

const footerLinkClass = cn(
  "rounded text-body-sm text-on-surface-variant transition-colors hover:text-on-surface",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
);

const columnHeadingClass = "text-label-mono-xs text-on-surface-variant";

/**
 * Minimal inline brand marks for the social row below. `lucide-react` 1.x
 * dropped all trademarked brand icons (Facebook/Instagram/YouTube no longer
 * exist as exports — see the 30-primitive typecheck pass that caught this),
 * so these are small hand-drawn `currentColor` glyphs instead of a new icon
 * dependency. Sized by the same `[&_svg]:size-4` rule the `Button` primitive
 * already applies to any child `<svg>`, so no explicit size prop is needed
 * where they're used.
 */
function FacebookGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M13.5 21v-7.5h2.5l.5-3h-3V8.25c0-.87.24-1.46 1.5-1.46h1.6V4.14C15.77 4.06 14.73 4 13.5 4 11.02 4 9.5 5.48 9.5 8v2.5H7v3h2.5V21h4Z" />
    </svg>
  );
}

function InstagramGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      aria-hidden="true"
      {...props}
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="16.7" cy="7.3" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

function YoutubeGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M21.6 8.2c-.2-1.2-.9-2-2-2.2C17.9 5.6 12 5.6 12 5.6s-5.9 0-7.6.4c-1.1.2-1.8 1-2 2.2C2 9.9 2 12 2 12s0 2.1.4 3.8c.2 1.2.9 2 2 2.2 1.7.4 7.6.4 7.6.4s5.9 0 7.6-.4c1.1-.2 1.8-1 2-2.2.4-1.7.4-3.8.4-3.8s0-2.1-.4-3.8ZM10 15V9l5.2 3-5.2 3Z" />
    </svg>
  );
}

interface FooterLink {
  label: string;
  href: string;
}

interface FooterColumnProps {
  heading: string;
  links: FooterLink[];
}

function FooterColumn({ heading, links }: FooterColumnProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className={columnHeadingClass}>{heading}</p>
      <ul className="flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={footerLinkClass}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const SHOP_LINKS: FooterLink[] = [
  { label: "Laptops", href: "/c/laptops" },
  { label: "Desktops", href: "/c/desktops" },
  { label: "Components", href: "/c/components" },
  { label: "PC builder", href: "/build" },
  { label: "Deals", href: "/shop?sort=discount" },
];

const SUPPORT_LINKS: FooterLink[] = [
  { label: "Book a repair", href: "/service" },
  { label: "Track an order", href: "/track" },
  { label: "EMI calculator", href: "/emi-calculator" },
  { label: "Contact us", href: "/contact" },
];

const COMPANY_LINKS: FooterLink[] = [
  { label: "Our stores", href: "/stores" },
  { label: "Warranty", href: "/pages/warranty" },
  { label: "Contact us", href: "/contact" },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy policy", href: "/pages/privacy" },
  { label: "Terms of service", href: "/pages/terms" },
  { label: "Returns policy", href: "/pages/returns" },
];

export function SiteFooter({ className }: SiteFooterProps) {
  const [submitted, setSubmitted] = React.useState(false);

  function handleNewsletterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // No newsletter API route exists yet — this is a presentational v1 that
    // just acknowledges the submission locally. Wiring a real endpoint
    // (and validating/storing the address) is a later phase.
    setSubmitted(true);
  }

  function openCookieSettings() {
    window.dispatchEvent(new Event(OPEN_COOKIE_SETTINGS_EVENT));
  }

  return (
    <footer className={cn("border-t border-glass-stroke bg-surface-container", className)}>
      <div className="mx-auto max-w-[1280px] px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          <div className="flex flex-col gap-4 sm:col-span-2 lg:col-span-1">
            <Link href="/" className="rounded text-title text-on-surface w-fit">
              City Computer
            </Link>
            <p className="text-body-sm text-on-surface-variant">
              Genuine products, best prices — New Road, Kathmandu.
            </p>
            <p className="text-body-sm text-on-surface-variant">
              {formatNepalPhoneForDisplay(SHOP_PHONE_E164)}
            </p>
            <p className="text-body-sm text-on-surface-variant">New Road, Kathmandu</p>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" iconOnly asChild>
                <Link href="#" aria-label="City Computer on Facebook">
                  <FacebookGlyph />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" iconOnly asChild>
                <Link href="#" aria-label="City Computer on Instagram">
                  <InstagramGlyph />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" iconOnly asChild>
                <Link href="#" aria-label="City Computer on YouTube">
                  <YoutubeGlyph />
                </Link>
              </Button>
            </div>
          </div>

          <FooterColumn heading="Shop" links={SHOP_LINKS} />
          <FooterColumn heading="Support" links={SUPPORT_LINKS} />
          <FooterColumn heading="Company" links={COMPANY_LINKS} />

          <div className="flex flex-col gap-4">
            <p className={columnHeadingClass}>Legal</p>
            <ul className="flex flex-col gap-3">
              {LEGAL_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={footerLinkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <button type="button" onClick={openCookieSettings} className={footerLinkClass}>
                  Cookie settings
                </button>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-glass-stroke pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-body-md text-on-surface">Get restock alerts and deals</p>
            <p className="text-body-sm text-on-surface-variant">
              One email a week, no spam. Unsubscribe anytime.
            </p>
          </div>

          {submitted ? (
            <p className="text-body-sm text-on-surface">Thanks — you&apos;re on the list.</p>
          ) : (
            <form
              onSubmit={handleNewsletterSubmit}
              className="flex w-full max-w-md gap-2 sm:w-auto"
            >
              <Input
                type="email"
                required
                placeholder="you@example.com"
                aria-label="Email address"
                className="flex-1"
              />
              <Button type="submit" variant="primary">
                Subscribe
              </Button>
            </form>
          )}
        </div>

        <div className="mt-10 flex flex-col gap-4 border-t border-glass-stroke pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-sm text-on-surface-variant">
            © {new Date().getFullYear()} City Computer. All rights reserved.
          </p>
          <LocaleSwitcher />
        </div>
      </div>
    </footer>
  );
}
