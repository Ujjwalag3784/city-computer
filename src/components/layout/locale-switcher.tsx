"use client";

import * as React from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * LocaleSwitcher — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "**`LocaleSwitcher`**" (bold = not present in the Stitch designs,
 * designed from scratch here). Supports the two locales called out in
 * docs/02/docs/11: `en` (English, default/unprefixed) and `ne` (Nepali,
 * `/ne`-prefixed) — language-only codes, not `en-NP`/`ne-NP`.
 *
 * IMPORTANT — no real i18n routing exists yet: this codebase has no
 * `next-intl` (or equivalent) locale-aware router wired in. This component
 * is deliberately self-contained and prop-driven so it can be dropped in
 * now and rewired later without changing its public shape:
 *   - If `onLocaleChange` is passed, it is called with the selected locale
 *     and the caller (a future `next-intl`-aware wrapper) owns what
 *     happens next (e.g. `router.replace(pathname, { locale })`).
 *   - If it is not passed, selecting an item is a no-op as far as any
 *     external routing goes — the menu still closes and the checkmark
 *     still tracks `currentLocale`, so the UI is fully demoable, but
 *     nothing actually navigates. Wiring this to real locale-prefixed
 *     routes is explicitly a later phase.
 *
 * Built on the Radix-backed `DropdownMenu` primitives (docs/05 §5 A5:
 * composite widgets must use Radix, never hand-rolled).
 *
 * Accessibility: the trigger's visible text ("EN"/"NE") is technically a
 * sufficient accessible name, but it reads ambiguously out of context, so
 * an explicit `aria-label="Change language"` is layered on top for safety
 * (docs/05 §5 A2). The active locale is marked with both a `Check` icon and
 * `aria-current="true"` — never colour alone (§5 A6).
 */
export interface LocaleSwitcherProps {
  /** The currently active locale. Defaults to `"en"`. */
  currentLocale?: "en" | "ne";
  /** Called with the newly selected locale. See the component doc for why this may be omitted. */
  onLocaleChange?: (locale: "en" | "ne") => void;
  className?: string;
}

/** Kept as standalone constants (rather than indexing the array below) so the
 * "en" fallback used in `active` never depends on unsound array-index typing. */
const ENGLISH_LOCALE = { code: "en" as const, label: "English", tag: "EN" };
const NEPALI_LOCALE = { code: "ne" as const, label: "नेपाली", tag: "NE" };

const LOCALES: Array<{ code: "en" | "ne"; label: string; tag: string }> = [
  ENGLISH_LOCALE,
  NEPALI_LOCALE,
];

export function LocaleSwitcher({
  currentLocale = "en",
  onLocaleChange,
  className,
}: LocaleSwitcherProps) {
  const active = LOCALES.find((locale) => locale.code === currentLocale) ?? ENGLISH_LOCALE;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label="Change language"
          className={cn("gap-1.5", className)}
        >
          <Globe />
          <span>{active.tag}</span>
          <ChevronDown className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LOCALES.map((locale) => {
          const isActive = locale.code === currentLocale;

          return (
            <DropdownMenuItem
              key={locale.code}
              aria-current={isActive ? "true" : undefined}
              onSelect={() => onLocaleChange?.(locale.code)}
            >
              <Check className={cn("size-4", isActive ? "opacity-100" : "opacity-0")} />
              <span className="flex-1">{locale.label}</span>
              <span className="text-label-mono-xs text-on-surface-variant">{locale.tag}</span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
