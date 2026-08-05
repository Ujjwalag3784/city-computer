/**
 * Pure logic behind `src/components/admin/seo-preview.tsx`'s character
 * counters and traffic-light hint, extracted so it has a real unit test —
 * the component itself is a `"use client"` React component and this repo
 * has no component-rendering test infrastructure yet (no jsdom/happy-dom,
 * no `@testing-library/react`, `vitest.config.ts`'s `environment: "node"`
 * only globs `*.test.ts`). Standing up a whole DOM-testing stack for one
 * component was judged out of scope for this pass; extracting the actual
 * decision logic into a plain function this file can test directly gets
 * the same coverage of what actually matters (the threshold math) without
 * inventing new test infrastructure. See PROGRESS.md Phase 11.
 *
 * Thresholds are docs/11-SEO-STRATEGY.md §3's exact length-budget table
 * ("<title> target 50-60, hard max 65, hint: amber <35 or >60, red >65" /
 * "meta description target 140-160, hard max 165, hint: amber <110 or
 * >160, red >165"). The two hard maxima are imported from `./limits`'s
 * `TITLE_HARD_MAX`/`DESCRIPTION_HARD_MAX` — the same constants
 * `./metadata` clamps real `<title>`/`<meta description>` output at — so
 * the admin hint and the real truncation behaviour can't drift apart.
 *
 * They come from `./limits` rather than straight from `./metadata` (where
 * they used to live) purely to keep this file client-safe: `./metadata`
 * reaches `@/env` via `./site`, and `@/env` carries `import "server-only"`,
 * so importing it from here dragged the whole server config chain into the
 * client bundle through `seo-preview.tsx` and broke the production build.
 * `./limits` is an import-free leaf, so the single-source-of-truth property
 * survives intact. Do not reintroduce an import of `./metadata` here.
 */
import { DESCRIPTION_HARD_MAX, TITLE_HARD_MAX } from "./limits";

export const TITLE_MIN = 35;
export const TITLE_WARN_AT = 60;
export const TITLE_DANGER_AT = TITLE_HARD_MAX;
export const DESCRIPTION_MIN = 110;
export const DESCRIPTION_WARN_AT = 160;
export const DESCRIPTION_DANGER_AT = DESCRIPTION_HARD_MAX;

export interface CounterCopy {
  text: string;
  /** One of the three Obsidian Peak status classes — never colour alone (docs/05 §5 A6), the `text` itself also changes per threshold. */
  className: "text-danger" | "text-warning" | "text-on-surface-variant";
}

export function titleCounterCopy(length: number): CounterCopy {
  if (length > TITLE_DANGER_AT) {
    return {
      text: `${length} / ${TITLE_WARN_AT} — too long, Google will cut this off`,
      className: "text-danger",
    };
  }
  if (length > TITLE_WARN_AT) {
    return { text: `${length} / ${TITLE_WARN_AT} — a bit long`, className: "text-warning" };
  }
  if (length > 0 && length < TITLE_MIN) {
    return { text: `${length} / ${TITLE_WARN_AT} — a bit short`, className: "text-warning" };
  }
  return { text: `${length} / ${TITLE_WARN_AT}`, className: "text-on-surface-variant" };
}

export function descriptionCounterCopy(length: number): CounterCopy {
  if (length > DESCRIPTION_DANGER_AT) {
    return {
      text: `${length} / ${DESCRIPTION_WARN_AT} — too long, Google will cut this off`,
      className: "text-danger",
    };
  }
  if (length > DESCRIPTION_WARN_AT) {
    return {
      text: `${length} / ${DESCRIPTION_WARN_AT} — a bit long`,
      className: "text-warning",
    };
  }
  if (length > 0 && length < DESCRIPTION_MIN) {
    return {
      text: `${length} / ${DESCRIPTION_WARN_AT} — a bit short`,
      className: "text-warning",
    };
  }
  return { text: `${length} / ${DESCRIPTION_WARN_AT}`, className: "text-on-surface-variant" };
}

export interface SeoHintInput {
  title: string;
  description: string;
  /** Used by the "mentions the product/entity name" check — omit to skip it (e.g. a CMS page with no single "product name" concept). */
  entityName?: string;
}

export interface SeoHint {
  titleCounter: CounterCopy;
  descriptionCounter: CounterCopy;
  titleOk: boolean;
  descriptionOk: boolean;
  looksGood: boolean;
  issues: string[];
}

/** The full traffic-light verdict `SeoPreview` renders — one function so the component has nothing left to get wrong beyond wiring it up. */
export function computeSeoHint(input: SeoHintInput): SeoHint {
  const { title, description, entityName } = input;
  const titleCounter = titleCounterCopy(title.length);
  const descriptionCounter = descriptionCounterCopy(description.length);

  const titleOk = title.length >= TITLE_MIN && title.length <= TITLE_WARN_AT;
  const descriptionOk =
    description.length >= DESCRIPTION_MIN && description.length <= DESCRIPTION_WARN_AT;

  const nameLower = entityName?.toLowerCase();
  const titleMentionsName = !nameLower || title.toLowerCase().includes(nameLower);
  const descriptionMentionsName = !nameLower || description.toLowerCase().includes(nameLower);

  const looksGood = titleOk && descriptionOk && titleMentionsName && descriptionMentionsName;

  const issues: string[] = [];
  if (title.length === 0) {
    issues.push("Add a page title");
  } else if (title.length > TITLE_DANGER_AT) {
    issues.push("Page title is too long");
  } else if (title.length > TITLE_WARN_AT) {
    issues.push("Page title is a bit long");
  } else if (title.length < TITLE_MIN) {
    issues.push("Page title is a bit short");
  }
  if (description.length === 0) {
    issues.push("Add a search description");
  } else if (description.length > DESCRIPTION_DANGER_AT) {
    issues.push("Search description is too long");
  } else if (description.length > DESCRIPTION_WARN_AT) {
    issues.push("Search description is a bit long");
  } else if (description.length < DESCRIPTION_MIN) {
    issues.push("Search description is a bit short");
  }
  if (nameLower && title.length > 0 && !titleMentionsName) {
    issues.push("Page title doesn't mention the product name");
  }
  if (nameLower && description.length > 0 && !descriptionMentionsName) {
    issues.push("Search description doesn't mention the product name");
  }

  return { titleCounter, descriptionCounter, titleOk, descriptionOk, looksGood, issues };
}
