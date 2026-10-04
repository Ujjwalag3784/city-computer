"use client";

import * as React from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * AnnouncementBar — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "`AnnouncementBar`". A thin promotional/informational strip that sits
 * above `SiteHeader` (e.g. "Free delivery inside Kathmandu Valley on orders
 * over Rs. 5,000").
 *
 * Must be a Client Component: dismissal is local `useState`, no
 * `"use client"` wouldn't compile with the `onClick` handler below. The
 * dismissal is session-only (resets on reload/navigation to a fresh mount) —
 * persisting it across sessions via `localStorage` or a cookie is a
 * reasonable future enhancement, out of scope for this v1.
 *
 * CLS: per docs/11-SEO-STRATEGY.md, the announcement bar must never cause an
 * *unprompted* layout shift. This component satisfies that by rendering at a
 * fixed `min-h-10` from first paint (no async height change) and by
 * rendering `null` (not a zero-height placeholder) once dismissed — the
 * resulting reflow is a direct, user-triggered response to a click, which is
 * not the kind of shift CLS penalizes.
 *
 * Accessibility: the close button is visually a small icon inside a slim
 * bar, but its hit target is a full `size-11` (44×44 CSS px, docs/05 §5 A9)
 * absolutely positioned so it overlaps the bar without forcing it taller —
 * the same technique `SheetContent`'s close button uses. Focus ring follows
 * docs/05 §5 A11's standard pattern.
 */
export interface AnnouncementMetaItem {
  label: string;
  href?: string;
}

export interface AnnouncementBarProps {
  /** The announcement copy, e.g. "Free delivery inside Kathmandu Valley on orders over Rs. 5,000." */
  message: string;
  /** Optional short lead-in rendered in orange caps before the message, e.g. "Free delivery". */
  highlight?: string;
  /** Optional destination for an inline link rendered after the message. */
  href?: string;
  /** Label for the inline link. Required (and only rendered) when `href` is set. */
  linkLabel?: string;
  /** Right-aligned store facts (address, phone), shown from `md` up. */
  meta?: AnnouncementMetaItem[];
  /** Whether the bar can be dismissed with a close button. Defaults to `false` (it is the store's contact strip now, not a promo). */
  dismissible?: boolean;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * 2026-10-04 redesign: Stitch's thin utility strip — a mono "● FREE DELIVERY
 * inside Kathmandu Valley …" on the left and store facts on the right, on
 * the canvas colour with a hairline below, instead of a solid colour band.
 */
export function AnnouncementBar({
  message,
  highlight,
  href,
  linkLabel,
  meta = [],
  dismissible = false,
}: AnnouncementBarProps) {
  const [open, setOpen] = React.useState(true);

  if (!open) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Announcement"
      className="relative border-b border-outline-variant bg-background"
    >
      <div className="mx-auto flex min-h-9 max-w-[1440px] items-center justify-between gap-6 px-4 font-mono text-[0.6875rem] tracking-[0.02em] text-on-surface-variant sm:px-6 lg:px-12">
        <p className="flex min-w-0 items-center gap-2">
          <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full bg-primary" />
          <span className="truncate">
            {highlight && <span className="font-medium uppercase text-primary">{highlight} </span>}
            {message}
            {href && linkLabel && (
              <>
                {" "}
                <Link
                  href={href}
                  className={cn(
                    "rounded text-on-surface underline underline-offset-2 hover:no-underline",
                    focusRing,
                  )}
                >
                  {linkLabel}
                </Link>
              </>
            )}
          </span>
        </p>

        {meta.length > 0 && (
          <ul className="hidden shrink-0 items-center gap-4 md:flex">
            {meta.map((item, index) => (
              <li key={item.label} className="flex items-center gap-4">
                {index > 0 && <span aria-hidden="true" className="h-3 w-px bg-outline-variant" />}
                {item.href ? (
                  <a href={item.href} className={cn("rounded hover:text-on-surface", focusRing)}>
                    {item.label}
                  </a>
                ) : (
                  <span>{item.label}</span>
                )}
              </li>
            ))}
          </ul>
        )}

        {dismissible && (
          <button
            type="button"
            aria-label="Dismiss announcement"
            onClick={() => setOpen(false)}
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full text-on-surface-variant transition-colors hover:text-on-surface",
              focusRing,
            )}
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
