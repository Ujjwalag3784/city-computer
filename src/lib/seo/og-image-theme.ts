/**
 * docs/11-SEO-STRATEGY.md §7.5: "Generated dynamically ... using the
 * Obsidian Peak tokens, so social cards are always current and never a
 * stale upload." `next/og`'s edge renderer can't read `globals.css`
 * (no CSS engine, no CSS custom properties) — this module is the one
 * place the handful of tokens OG images actually need are duplicated as
 * plain hex strings, copied verbatim from `src/app/globals.css`'s dark
 * theme (the only theme this app ships), so a future palette change has
 * exactly one other file to update.
 */
export const OG_COLORS = {
  background: "#09090b",
  surface: "#131315",
  primary: "#a4e6ff",
  onSurface: "#e5e1e4",
  onSurfaceVariant: "#bbc9cf",
} as const;

export const OG_IMAGE_SIZE = { width: 1200, height: 630 } as const;
export const OG_CONTENT_TYPE = "image/png" as const;
