import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * A plain `twMerge` has no idea globals.css's custom `@utility` blocks
 * exist — it only recognises Tailwind's own built-in classes. Found the
 * hard way: `cn("text-price", "text-on-surface")` was silently returning
 * just `"text-on-surface"`, because twMerge's default config pattern-matches
 * *any* unrecognised `text-{word}` class into its built-in "text color"
 * group, sees `text-price` and `text-on-surface` as two classes fighting
 * over that one group, and keeps only the later argument — dropping the
 * font entirely. This wasn't a one-off: `PriceBlock`'s `cn(priceSizeClass[
 * size], "text-on-surface")` call is exactly this shape, so every price on
 * the site (`text-price`/`text-price-lg`, the "md"/"lg" sizes) has been
 * rendering as plain, unstyled text color with no font-size/weight/tabular-
 * nums applied — never the intended bold display type. `text-display-lg`,
 * `text-headline-lg/md`, `text-title`, `text-body-lg/md/sm`, and
 * `text-label-mono(-xs)` all reproduce the same drop when combined with a
 * `text-*` colour class via `cn()`; only static className strings (never
 * passed through `cn()`) escaped it, which is why e.g. the homepage hero's
 * literal `"text-display-lg text-on-surface"` string rendered fine while
 * anything building the same pair through `cn()` did not.
 *
 * Fix: register every custom typography (and `bg-grid-fade`, sharing
 * Tailwind's `bg-` prefix with real background-colour utilities) utility
 * in its own dedicated group, so twMerge stops guessing and never treats
 * them as conflicting with an unrelated colour class again.
 */
type CustomClassGroupId =
  | "font-display-scale"
  | "font-body-scale"
  | "font-mono-scale"
  | "bg-texture";

const twMerge = extendTailwindMerge<CustomClassGroupId>({
  extend: {
    classGroups: {
      "font-display-scale": [
        "text-display-lg",
        "text-headline-lg",
        "text-headline-md",
        "text-title",
        "text-price",
        "text-price-lg",
      ],
      "font-body-scale": ["text-body-lg", "text-body-md", "text-body-sm"],
      "font-mono-scale": ["text-label-mono", "text-label-mono-xs"],
      "bg-texture": ["bg-grid-fade"],
    },
  },
});

/**
 * Merges class strings, resolving conflicting Tailwind utilities in favour
 * of the later one (e.g. `cn("p-2", condition && "p-4")` keeps `p-4` when
 * `condition` is true). The one class-merging helper every component uses —
 * see docs/04-REPOSITORY-STRUCTURE.md §2 (`lib/utils.ts cn(), typed helpers
 * only — no dumping ground`).
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
