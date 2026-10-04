import { cn } from "@/lib/utils";

/**
 * The City Computer emblem + wordmark, from the owner's Stitch export
 * (`city_computer_systems_logo`). The emblem is inline SVG so it inherits no
 * network cost; the wordmark is real text (selectable, translatable, and
 * rendered in the loaded Manrope / JetBrains Mono rather than whatever an
 * SVG <text> element falls back to).
 *
 * Colours are the Obsidian Kinetic token values, referenced through CSS
 * variables so the mark follows the theme.
 */
export function BrandEmblem({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 36 36" fill="none" aria-hidden="true" className={cn("size-9", className)}>
      <rect
        x="0.75"
        y="0.75"
        width="34.5"
        height="34.5"
        rx="8"
        fill="var(--surface)"
        stroke="var(--outline-variant)"
        strokeWidth="1.5"
      />
      <path d="M18 6V30M6 18H30" stroke="var(--outline-variant)" strokeWidth="1" />
      <rect x="13" y="13" width="10" height="10" rx="3" fill="var(--primary)" />
      <circle cx="9" cy="9" r="2.5" fill="var(--on-surface)" />
      <circle cx="27" cy="27" r="2.5" fill="var(--on-surface)" />
      <circle cx="27" cy="9" r="2" fill="var(--on-surface-variant)" />
      <circle cx="9" cy="27" r="2" fill="var(--on-surface-variant)" />
    </svg>
  );
}

export interface BrandMarkProps {
  className?: string;
  /** Hide the "SYSTEMS • NEW ROAD" sub-line (tight spaces). */
  compact?: boolean;
}

export function BrandMark({ className, compact = false }: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-3", className)}>
      <BrandEmblem />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[0.9375rem] font-extrabold tracking-[-0.005em] text-on-surface uppercase">
          City Computer
        </span>
        {!compact && (
          <span className="mt-1 font-mono text-[0.5625rem] font-semibold tracking-[0.16em] text-on-surface-variant uppercase">
            Systems • New Road
          </span>
        )}
      </span>
    </span>
  );
}
