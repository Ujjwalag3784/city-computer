/**
 * The two `<title>` / `<meta description>` hard maxima from
 * docs/11-SEO-STRATEGY.md §3's length-budget table — and deliberately
 * nothing else.
 *
 * **This module must keep exactly zero imports.** It is the shared leaf
 * that both sides of the SEO length budget read from:
 *
 * - `./metadata` (server) truncates real `<title>`/`<meta description>`
 *   output at these lengths via `buildMetaTitle`/`clampDescription`.
 * - `./serp-hint` (client-safe) turns the admin SERP preview's character
 *   counters red at the same lengths.
 *
 * so the admin's "too long, Google will cut this off" warning and the
 * actual truncation behaviour can't drift apart.
 *
 * Why they aren't just left in `./metadata`, where they used to live:
 * `serp-hint.ts` is imported by `src/components/admin/seo-preview.tsx`,
 * which is a `"use client"` component. `./metadata` imports `./site`, which
 * imports `@/env`, which carries `import "server-only"` — so reading the
 * maxima from `./metadata` pulled the entire validated server config chain
 * into the client bundle and failed the first real production build with
 * "You're importing a component that needs server-only". A leaf module with
 * no imports of its own keeps the single-source-of-truth property without
 * the client bundle ever touching that chain. Adding an import here would
 * silently re-open the same hole — `src/lib/client-boundary.test.ts` is the
 * guard that would catch it.
 */

/** docs/11 §3.3: `<title>` targets 50-60 characters; 65 is the hard max, clamped at a word boundary and never with an ellipsis. */
export const TITLE_HARD_MAX = 65;

/** docs/11 §3.4: `<meta description>` targets 140-160 characters; 165 is the hard max. */
export const DESCRIPTION_HARD_MAX = 165;
