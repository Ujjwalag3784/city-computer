"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

/**
 * CookieConsent — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "**`CookieConsent`**". Implements the cookie banner spec in
 * docs/12-ANALYTICS-MARKETING.md §11 "Consent and privacy":
 * appears on first visit (before any non-essential tag fires), offers
 * "Accept all" / "Reject all" / "Choose" with equal visual prominence (a
 * hidden or de-emphasised reject button is a dark pattern per that doc), and
 * four categories — Essential (always on, not a real toggle), Analytics,
 * Marketing, Preferences.
 *
 * Storage contract: consent is persisted to `localStorage` under
 * `"cc-cookie-consent"` as `{"version":1,"timestamp":<ms>,"categories":
 * {"analytics":bool,"marketing":bool,"preferences":bool}}`. The banner shows
 * whenever that key is missing, unparsable, or older than 12 months
 * (docs/12 §11 "Persistence"). This file owns that shape end-to-end via the
 * module-level `readConsent()` / `writeConsent()` helpers below — no
 * separate storage module.
 *
 * Reopen contract (docs/12 §11 "Withdrawal" — a permanent footer link):
 * this component listens on `window` for a custom event named
 * `"citycomputer:open-cookie-settings"` and, on receiving it, re-shows the
 * banner regardless of any stored consent. `SiteFooter`'s "Cookie settings"
 * control dispatches that exact event —
 * `window.dispatchEvent(new Event("citycomputer:open-cookie-settings"))` —
 * these are the only two places in the codebase that touch this event name,
 * and the string must stay byte-identical between them.
 *
 * Layout / CLS: the banner is `fixed inset-x-0 bottom-0`, so it overlays
 * rather than reflowing page content, and the "Choose" action opens a
 * `Dialog` instead of expanding the bar in place — the fixed bar's own
 * height never changes, so there is no unprompted layout shift (docs/12 §11
 * "Layout": "must never cause CLS").
 *
 * i18n: docs/12 §11 calls for a Nepali translation of this banner. There is
 * no i18n routing in this codebase yet (see `LocaleSwitcher`'s doc comment)
 * — all copy below is hardcoded English; Nepali strings land with the i18n
 * phase, not here.
 *
 * Client Component: reads/writes `localStorage`, listens for a `window`
 * event, and drives a Radix `Dialog` — none of that is possible from a
 * Server Component.
 */
export interface CookieConsentProps {
  className?: string;
}

/** Custom event name `SiteFooter`'s "Cookie settings" control dispatches. See the file header above. */
const OPEN_COOKIE_SETTINGS_EVENT = "citycomputer:open-cookie-settings";

const CONSENT_STORAGE_KEY = "cc-cookie-consent";
const CONSENT_VERSION = 1;
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 12 months, docs/12 §11 "Persistence"

interface ConsentCategories {
  analytics: boolean;
  marketing: boolean;
  preferences: boolean;
}

interface StoredConsent {
  version: number;
  timestamp: number;
  categories: ConsentCategories;
}

const DEFAULT_CATEGORIES: ConsentCategories = {
  analytics: false,
  marketing: false,
  preferences: false,
};

/** Reads and validates the stored consent record. Returns null if missing, malformed, or unparsable. */
function readConsent(): StoredConsent | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredConsent> | null;
    if (!parsed || typeof parsed.timestamp !== "number" || typeof parsed.categories !== "object") {
      return null;
    }

    const categories = parsed.categories as Partial<ConsentCategories> | null;
    if (!categories) return null;

    return {
      version: typeof parsed.version === "number" ? parsed.version : CONSENT_VERSION,
      timestamp: parsed.timestamp,
      categories: {
        analytics: Boolean(categories.analytics),
        marketing: Boolean(categories.marketing),
        preferences: Boolean(categories.preferences),
      },
    };
  } catch {
    return null;
  }
}

/** Persists `categories` (essential is implicit and never stored) with a fresh timestamp. */
function writeConsent(categories: ConsentCategories): void {
  if (typeof window === "undefined") return;

  const record: StoredConsent = {
    version: CONSENT_VERSION,
    timestamp: Date.now(),
    categories,
  };
  window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(record));
}

/** True if a stored consent record exists and is still within the 12-month re-ask window. */
function isConsentCurrent(stored: StoredConsent | null): boolean {
  if (!stored) return false;
  return Date.now() - stored.timestamp <= CONSENT_MAX_AGE_MS;
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export function CookieConsent({ className }: CookieConsentProps) {
  const [bannerOpen, setBannerOpen] = React.useState(false);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [categories, setCategories] = React.useState<ConsentCategories>(DEFAULT_CATEGORIES);

  React.useEffect(() => {
    if (!isConsentCurrent(readConsent())) {
      setBannerOpen(true);
    }
  }, []);

  React.useEffect(() => {
    function handleReopen() {
      setBannerOpen(true);
    }

    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleReopen);
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleReopen);
  }, []);

  function acceptAll() {
    writeConsent({ analytics: true, marketing: true, preferences: true });
    setDialogOpen(false);
    setBannerOpen(false);
  }

  function rejectAll() {
    writeConsent({ analytics: false, marketing: false, preferences: false });
    setDialogOpen(false);
    setBannerOpen(false);
  }

  function openChoose() {
    const stored = readConsent();
    setCategories(stored?.categories ?? DEFAULT_CATEGORIES);
    setDialogOpen(true);
  }

  function savePreferences() {
    writeConsent(categories);
    setDialogOpen(false);
    setBannerOpen(false);
  }

  return (
    <>
      {bannerOpen && (
        <div
          role="region"
          aria-label="Cookie consent"
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 glass-panel border-t border-glass-stroke",
            className,
          )}
        >
          <div className="mx-auto flex max-w-[1280px] flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <p className="text-body-sm text-on-surface-variant">
              We use cookies to run this site and, with your permission, to understand traffic and
              personalise marketing. See our{" "}
              <Link
                href="/pages/privacy"
                className={cn("rounded underline underline-offset-2 hover:no-underline", focusRing)}
              >
                Cookie policy
              </Link>
              .
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="md" onClick={rejectAll}>
                Reject all
              </Button>
              <Button variant="ghost" size="md" onClick={openChoose}>
                Choose
              </Button>
              <Button variant="primary" size="md" onClick={acceptAll}>
                Accept all
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cookie settings</DialogTitle>
            <DialogDescription>
              Choose which categories of cookies we can use. Essential cookies are always on because
              the site can&apos;t work without them.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-body-md text-on-surface">Essential</p>
                <p className="text-body-sm text-on-surface-variant">
                  Required for the site to work — always on.
                </p>
              </div>
              <Switch checked disabled aria-label="Essential cookies, always on" />
            </div>

            <Separator />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-body-md text-on-surface">Analytics</p>
                <p className="text-body-sm text-on-surface-variant">
                  Helps us see which pages and products get used, so we can improve the site.
                </p>
              </div>
              <Switch
                checked={categories.analytics}
                onCheckedChange={(checked) =>
                  setCategories((prev) => ({ ...prev, analytics: checked }))
                }
                aria-label="Analytics cookies"
              />
            </div>

            <Separator />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-body-md text-on-surface">Marketing</p>
                <p className="text-body-sm text-on-surface-variant">
                  Lets us show you relevant offers on this site and elsewhere.
                </p>
              </div>
              <Switch
                checked={categories.marketing}
                onCheckedChange={(checked) =>
                  setCategories((prev) => ({ ...prev, marketing: checked }))
                }
                aria-label="Marketing cookies"
              />
            </div>

            <Separator />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-body-md text-on-surface">Preferences</p>
                <p className="text-body-sm text-on-surface-variant">
                  Remembers choices like recently viewed items and display settings.
                </p>
              </div>
              <Switch
                checked={categories.preferences}
                onCheckedChange={(checked) =>
                  setCategories((prev) => ({ ...prev, preferences: checked }))
                }
                aria-label="Preferences cookies"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={acceptAll}>
              Accept all
            </Button>
            <Button variant="primary" onClick={savePreferences}>
              Save preferences
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
