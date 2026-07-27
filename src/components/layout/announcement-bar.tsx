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
 * Token choice: `bg-primary-container text-on-primary-container` (both
 * defined in globals.css — `--primary-container: #00d1ff`,
 * `--on-primary-container: #00566a`) rather than `bg-primary text-on-primary`.
 * The container pairing is the brighter, more saturated cyan, which reads as
 * a deliberate promo strip against the near-black `--background` rather than
 * blending in with the rest of the chrome — appropriate for something meant
 * to grab attention above the header.
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
export interface AnnouncementBarProps {
  /** The announcement copy, e.g. "Free delivery inside Kathmandu Valley on orders over Rs. 5,000." */
  message: string;
  /** Optional destination for an inline link rendered after the message. */
  href?: string;
  /** Label for the inline link. Required (and only rendered) when `href` is set. */
  linkLabel?: string;
  /** Whether the bar can be dismissed with a close button. Defaults to `true`. */
  dismissible?: boolean;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function AnnouncementBar({
  message,
  href,
  linkLabel,
  dismissible = true,
}: AnnouncementBarProps) {
  const [open, setOpen] = React.useState(true);

  if (!open) {
    return null;
  }

  return (
    <div
      role="region"
      aria-label="Announcement"
      className="relative min-h-10 w-full bg-primary-container text-on-primary-container"
    >
      <div className="flex min-h-10 items-center justify-center gap-2 px-4 text-center text-body-sm">
        <span>{message}</span>
        {href && linkLabel && (
          <Link
            href={href}
            className={cn("rounded underline underline-offset-2 hover:no-underline", focusRing)}
          >
            {linkLabel}
          </Link>
        )}
      </div>

      {dismissible && (
        <button
          type="button"
          aria-label="Dismiss announcement"
          onClick={() => setOpen(false)}
          className={cn(
            "absolute end-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-full",
            "text-on-primary-container/80 transition-colors hover:text-on-primary-container",
            focusRing,
          )}
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
