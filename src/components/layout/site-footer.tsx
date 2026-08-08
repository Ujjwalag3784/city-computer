"use client";

import * as React from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
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
 *  - WhatsApp number, contact email and store location (`SHOP_WHATSAPP_E164`
 *    / `SHOP_EMAIL` / `SHOP_MAPS_SHARE_URL` below) are the owner's real
 *    details, supplied directly — not seed/demo data. The map is a
 *    no-API-key `output=embed` iframe built from the resolved business name
 *    on the owner's Google Maps share link (see that constant's own
 *    comment); only a `Branch.phone`-style landline is still unwired,
 *    since none was supplied.
 *  - Facebook/Instagram/YouTube (`href="#"`) remain placeholders — real
 *    URLs land later; WhatsApp and email are real and live.
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
  /**
   * The newsletter form's real submit handler (Phase 10) — a plain async
   * function, not a direct `server/**` import, so this component stays
   * presentational per docs/04 §3's "`components/` never imports
   * `server/**`" boundary. The actual Server Action
   * (`subscribeNewsletterAction`) is wired in from `(storefront)/
   * layout.tsx`, the one layer allowed to know about both sides. Omitting
   * this prop preserves the original Phase 2 "acknowledges locally, does
   * nothing real" placeholder behaviour — useful for `/design` and any
   * other place this component renders without a real backend behind it.
   */
  onSubscribe?: (email: string) => Promise<{ ok: boolean; message?: string }>;
}

/** Real shop contact details, supplied directly by the owner (2026-08-07). */
const SHOP_WHATSAPP_E164 = "+9779741661095";
const SHOP_EMAIL = "agrawalujjwal244@gmail.com";
const SHOP_ADDRESS_LABEL = "New Road, Kathmandu";
/**
 * The owner's own Google Maps share link — used both as the "Get
 * directions" href (a share link opens correctly for a person, unlike an
 * embed URL) and, via its resolved business name, as the `q=` query for
 * the `output=embed` iframe below. Google's Maps embed accepts a place-name
 * text query with no API key required (the long-standing `output=embed`
 * form), which is what's used here rather than raw coordinates, since only
 * the share link — not a lat/long pair — was available.
 */
const SHOP_MAPS_SHARE_URL = "https://share.google/QWyBLoc2x6WksRaAN";
const SHOP_MAPS_EMBED_SRC =
  "https://www.google.com/maps?q=City+Computer+Systems,+New+Road,+Kathmandu,+Nepal&output=embed";

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

/** Same hand-drawn-glyph approach as the three above, for the same reason: `lucide-react` 1.x carries no WhatsApp mark. */
function WhatsappGlyph(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.77.46 3.45 1.32 4.94L2 22l5.29-1.39a9.9 9.9 0 0 0 4.75 1.21h.01c5.46 0 9.9-4.45 9.9-9.91S17.5 2 12.04 2Zm0 18.1h-.01a8.2 8.2 0 0 1-4.19-1.15l-.3-.18-3.14.82.84-3.06-.2-.31a8.2 8.2 0 0 1-1.27-4.4c0-4.55 3.71-8.26 8.27-8.26a8.2 8.2 0 0 1 5.85 2.42 8.2 8.2 0 0 1 2.42 5.84c0 4.56-3.71 8.27-8.27 8.27Zm4.53-6.19c-.25-.12-1.47-.72-1.7-.81-.23-.08-.39-.12-.56.13-.17.24-.64.8-.78.97-.14.16-.29.18-.53.06-.25-.12-1.05-.39-2-1.23-.74-.66-1.24-1.47-1.38-1.72-.15-.24-.02-.38.11-.5.11-.11.25-.29.37-.43.12-.14.16-.24.24-.4.08-.17.04-.31-.02-.43-.06-.12-.56-1.34-.76-1.84-.2-.48-.4-.42-.56-.42h-.48c-.16 0-.43.06-.65.31-.23.24-.85.83-.85 2.03s.87 2.36 1 2.52c.12.16 1.71 2.6 4.14 3.65.58.25 1.03.4 1.38.51.58.18 1.11.16 1.53.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.08.15-1.18-.06-.1-.23-.16-.48-.28Z" />
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
  { label: "Deals", href: "/shop?sort=-discount&onSale=true" },
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

// Slugs match the real seeded `Page` rows (`prisma/seed/content.ts`) exactly
// — these three previously pointed at slugs ("privacy"/"terms"/"returns")
// that don't exist, a leftover from when this footer was presentational-only
// (Phase 2). Fixed here now that `/pages/[slug]` (Phase 10) is a real route,
// since it's exactly the kind of dead link the new menu broken-link checker
// (`admin/menus.ts`) is meant to catch — this static footer isn't wired to
// that checker, but there's no reason to leave a known-broken link sitting
// next to it.
const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy policy", href: "/pages/privacy-policy" },
  { label: "Terms of service", href: "/pages/terms-conditions" },
  { label: "Returns policy", href: "/pages/refund-returns" },
];

export function SiteFooter({ className, onSubscribe }: SiteFooterProps) {
  const [submitted, setSubmitted] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleNewsletterSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!onSubscribe) {
      // No handler wired in (e.g. the `/design` showcase) — same
      // presentational-only acknowledgement this form has always had.
      setSubmitted(true);
      return;
    }

    setSubmitting(true);
    try {
      const result = await onSubscribe(email);
      if (!result.ok) {
        setError(result.message ?? "Couldn't subscribe right now. Please try again.");
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
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
            <Link
              href={`https://wa.me/${SHOP_WHATSAPP_E164.replace("+", "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(footerLinkClass, "text-on-surface-variant")}
            >
              {formatNepalPhoneForDisplay(SHOP_WHATSAPP_E164)} (WhatsApp)
            </Link>
            <Link
              href={`mailto:${SHOP_EMAIL}`}
              className={cn(footerLinkClass, "text-on-surface-variant")}
            >
              {SHOP_EMAIL}
            </Link>
            <Link
              href={SHOP_MAPS_SHARE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(footerLinkClass, "text-on-surface-variant")}
            >
              {SHOP_ADDRESS_LABEL}
            </Link>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" iconOnly asChild>
                <Link
                  href={`https://wa.me/${SHOP_WHATSAPP_E164.replace("+", "")}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Message City Computer on WhatsApp"
                >
                  <WhatsappGlyph />
                </Link>
              </Button>
              <Button variant="ghost" size="sm" iconOnly asChild>
                <Link href={`mailto:${SHOP_EMAIL}`} aria-label="Email City Computer">
                  <Mail />
                </Link>
              </Button>
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

        <div className="mt-10 grid gap-6 border-t border-glass-stroke pt-8 sm:grid-cols-2 sm:items-center">
          <div className="flex flex-col gap-2">
            <p className={columnHeadingClass}>Visit our store</p>
            <p className="text-body-md text-on-surface">City Computer, {SHOP_ADDRESS_LABEL}</p>
            <p className="text-body-sm text-on-surface-variant">
              Message us on{" "}
              <Link
                href={`https://wa.me/${SHOP_WHATSAPP_E164.replace("+", "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-on-surface underline underline-offset-2"
              >
                WhatsApp
              </Link>{" "}
              or email{" "}
              <Link
                href={`mailto:${SHOP_EMAIL}`}
                className="text-on-surface underline underline-offset-2"
              >
                {SHOP_EMAIL}
              </Link>
              .
            </p>
            <Link
              href={SHOP_MAPS_SHARE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-body-sm text-primary underline underline-offset-2 w-fit"
            >
              Get directions →
            </Link>
          </div>

          <div className="h-48 w-full overflow-hidden rounded border border-glass-stroke sm:h-56">
            <iframe
              title="City Computer store location"
              src={SHOP_MAPS_EMBED_SRC}
              className="h-full w-full border-0"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
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
            <p className="text-body-sm text-on-surface">
              Thanks — check your email to confirm your subscription.
            </p>
          ) : (
            <div className="flex w-full max-w-md flex-col gap-1 sm:w-auto">
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  aria-label="Email address"
                  className="flex-1"
                />
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Subscribing…" : "Subscribe"}
                </Button>
              </form>
              {error && <p className="text-body-sm text-danger">{error}</p>}
            </div>
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
