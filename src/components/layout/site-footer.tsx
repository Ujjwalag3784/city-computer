"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { formatNepalPhoneForDisplay } from "@/lib/nepal";
import { cn } from "@/lib/utils";
import { BrandMark } from "@/components/layout/brand-mark";
import {
  STORE_ADDRESS_LABEL,
  STORE_EMAIL,
  STORE_MAPS_EMBED_SRC,
  STORE_MAPS_SHARE_URL,
  STORE_WHATSAPP_E164,
  STORE_WHATSAPP_URL,
} from "@/config/store";

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
 * 2026-10-04 Obsidian Kinetic redesign (Stitch export): newsletter + map
 * band, brand block, four numbered link columns ("[01] Shop" …), and a
 * thin legal bar.
 *  - WhatsApp, email and store location come from `config/store.ts` — the
 *    owner's real details, shared with the header strip.
 *  - Facebook/Instagram/YouTube icons were removed: they linked to "#".
 *  - The payment chips list only what checkout really offers.
 *  - The newsletter form submits through `onSubscribe` (the real Server
 *    Action wired in `(storefront)/layout.tsx`).
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
/** Must match the listener in `src/components/layout/cookie-consent.tsx` exactly. */
const OPEN_COOKIE_SETTINGS_EVENT = "citycomputer:open-cookie-settings";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

const footerLinkClass = cn(
  "rounded text-body-md text-on-surface-variant transition-colors hover:text-on-surface",
  focusRing,
);

/** Hand-drawn `currentColor` glyph: `lucide-react` 1.x carries no WhatsApp mark. */
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
  index: string;
  heading: string;
  links: FooterLink[];
  children?: React.ReactNode;
}

function FooterColumn({ index, heading, links, children }: FooterColumnProps) {
  return (
    <div className="flex flex-col gap-5">
      <p className="font-mono text-label-mono-xs text-on-surface-variant">
        <span className="text-primary">[{index}]</span> {heading}
      </p>
      <ul className="flex flex-col gap-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link href={link.href} className={footerLinkClass}>
              {link.label}
            </Link>
          </li>
        ))}
        {children}
      </ul>
    </div>
  );
}

// Every href below is a real route (checked against the running app and
// the seeded `Page` slugs in `prisma/seed/content.ts`). The old footer's
// Facebook/Instagram/YouTube icons pointed at "#" — no real profile URLs
// exist yet, so they are gone rather than left as dead links.
const SHOP_LINKS: FooterLink[] = [
  { label: "Laptops", href: "/c/laptops" },
  { label: "Desktops & prebuilts", href: "/c/desktops-prebuilts" },
  { label: "Components", href: "/c/components" },
  { label: "Monitors", href: "/c/monitors" },
  { label: "Apple & Mac", href: "/c/apple-mac" },
  { label: "Deals", href: "/shop?sort=-discount&onSale=true" },
];

const BUILD_SERVICE_LINKS: FooterLink[] = [
  { label: "PC builder", href: "/build/new" },
  { label: "Book a repair", href: "/service/book" },
  { label: "Check repair status", href: "/service/status" },
  { label: "EMI calculator", href: "/emi-calculator" },
  { label: "Blog", href: "/blog" },
];

const HELP_LINKS: FooterLink[] = [
  { label: "Track an order", href: "/track" },
  { label: "Our stores", href: "/stores" },
  { label: "Warranty", href: "/pages/warranty" },
  { label: "Shipping", href: "/pages/shipping-policy" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact us", href: "/contact" },
];

const LEGAL_LINKS: FooterLink[] = [
  { label: "Privacy policy", href: "/pages/privacy-policy" },
  { label: "Terms of service", href: "/pages/terms-conditions" },
  { label: "Returns policy", href: "/pages/refund-returns" },
];

/** Only the payment methods checkout actually offers (Phase 7: COD + bank transfer). */
const PAYMENT_METHODS = ["Cash on delivery", "Bank transfer"];

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
    <footer className={cn("mt-16 border-t border-outline-variant bg-background", className)}>
      {/* Newsletter + map band */}
      <div className="border-b border-outline-variant">
        <div className="mx-auto grid max-w-[1440px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-2 lg:items-center lg:gap-16 lg:px-12">
          <div className="flex flex-col gap-4">
            <p className="eyebrow">Restock alerts &amp; deals</p>
            <h2 className="text-headline-md text-on-surface">
              Hear about new stock before it sells out.
            </h2>
            <p className="text-body-md text-on-surface-variant">
              One email a week, no spam. Unsubscribe anytime.
            </p>
            {submitted ? (
              <p role="status" className="text-body-md text-success">
                Thanks — check your email to confirm your subscription.
              </p>
            ) : (
              <div className="flex max-w-md flex-col gap-1">
                <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    aria-label="Email address"
                    autoComplete="email"
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

          <div className="panel overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-outline-variant px-5 py-3">
              <p className="font-mono text-label-mono-xs text-on-surface-variant">
                <span className="text-primary">●</span> Showroom · {STORE_ADDRESS_LABEL}
              </p>
              <Link
                href={STORE_MAPS_SHARE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "inline-flex items-center gap-1 rounded font-mono text-label-mono-xs text-primary hover:underline",
                  focusRing,
                )}
              >
                Directions <ArrowRight className="size-3" aria-hidden="true" />
              </Link>
            </div>
            <div className="h-48 w-full sm:h-56">
              <iframe
                title="City Computer store location"
                src={STORE_MAPS_EMBED_SRC}
                className="h-full w-full border-0 opacity-80 grayscale invert-[0.92] hue-rotate-180"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Link columns */}
      <div className="mx-auto max-w-[1440px] px-4 py-14 sm:px-6 lg:px-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-5 sm:col-span-2 lg:col-span-1">
            <Link
              href="/"
              aria-label="City Computer Systems — home"
              className={cn("w-fit rounded", focusRing)}
            >
              <BrandMark />
            </Link>
            <p className="max-w-xs text-body-md text-on-surface-variant">
              Genuine laptops, PCs, components and repairs from our showroom in New Road, Kathmandu.
            </p>
            <ul className="flex flex-col gap-2 font-mono text-[0.75rem] text-on-surface-variant">
              <li>
                <Link
                  href={STORE_MAPS_SHARE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn("rounded hover:text-on-surface", focusRing)}
                >
                  {STORE_ADDRESS_LABEL}, Nepal
                </Link>
              </li>
              <li>
                <Link
                  href={STORE_WHATSAPP_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center gap-2 rounded hover:text-on-surface",
                    focusRing,
                  )}
                >
                  <WhatsappGlyph className="size-3.5" />
                  {formatNepalPhoneForDisplay(STORE_WHATSAPP_E164)}
                </Link>
              </li>
              <li>
                <Link
                  href={`mailto:${STORE_EMAIL}`}
                  className={cn(
                    "inline-flex items-center gap-2 rounded break-all hover:text-on-surface",
                    focusRing,
                  )}
                >
                  <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                  {STORE_EMAIL}
                </Link>
              </li>
            </ul>
            <ul className="flex flex-wrap gap-2" aria-label="Payment methods we accept">
              {PAYMENT_METHODS.map((method) => (
                <li
                  key={method}
                  className="rounded border border-outline-variant bg-surface px-2 py-1 font-mono text-[0.625rem] uppercase tracking-[0.06em] text-on-surface-variant"
                >
                  {method}
                </li>
              ))}
            </ul>
          </div>

          <FooterColumn index="01" heading="Shop" links={SHOP_LINKS} />
          <FooterColumn index="02" heading="Build & service" links={BUILD_SERVICE_LINKS} />
          <FooterColumn index="03" heading="Help" links={HELP_LINKS} />
          <FooterColumn index="04" heading="Legal" links={LEGAL_LINKS}>
            <li>
              <button type="button" onClick={openCookieSettings} className={footerLinkClass}>
                Cookie settings
              </button>
            </li>
          </FooterColumn>
        </div>
      </div>

      <div className="border-t border-outline-variant">
        <div className="mx-auto flex max-w-[1440px] flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-12">
          <p className="font-mono text-label-mono-xs text-on-surface-variant">
            © {new Date().getFullYear()} City Computer Systems. All rights reserved.
          </p>
          <LocaleSwitcher />
        </div>
      </div>
    </footer>
  );
}
