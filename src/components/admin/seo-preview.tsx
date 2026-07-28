"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/**
 * SeoPreview — docs/09-ADMIN-DAD-MODE.md §5.1 Step 4 "Search information".
 *
 * Page Title: "The title Google shows. Keep it under 60 characters." —
 * pre-filled by the caller from `{Product name} Price in Nepal | {Brand} |
 * City Computer` (this component just renders/edits whatever `pageTitle`
 * it's given; computing that default string is the parent form's job).
 * Search Description: "The description Google shows underneath. Keep it
 * under 160 characters." — likewise pre-filled by the caller from the short
 * description and key specs.
 *
 * "Below them, a live Google result preview rendered exactly as a SERP
 * entry, plus a traffic-light hint ... An 'Advanced settings' section,
 * collapsed by default and labelled 'Only change these if someone has
 * asked you to', exposes the website link and canonical override."
 *
 * Thresholds (character counters + traffic-light hint):
 * - Title: warn amber past 60 (the doc's own limit), danger red past 65 —
 *   a 5-character grace band before calling it "too long", per the doc's
 *   explicit 60/65 pair.
 * - Description: warn amber past 160 (the doc's limit), danger red past
 *   175 — the same proportionally-sized grace band as the title (roughly
 *   +8-9%), scaled up for the longer field. Also flagged (amber, not red)
 *   below 50 characters as "a bit short" — short enough that it's unlikely
 *   to say anything useful about the product, but not long enough to
 *   justify a hard floor.
 * - The counter text itself changes (not just colour) past each threshold,
 *   per docs/05-DESIGN-SYSTEM.md §5 A6 "status never communicated by
 *   colour alone".
 *
 * The Google SERP mock below the fields is a deliberate one-off visual
 * reference to a real Google search result — not part of the Obsidian Peak
 * component system — so it's styled to loosely resemble an actual SERP
 * entry rather than reusing token-driven card styles, and is labelled with
 * a small "Preview" eyebrow so it doesn't read as a broken/unstyled
 * component.
 */

const TITLE_WARN_AT = 60;
const TITLE_DANGER_AT = 65;
const DESCRIPTION_WARN_AT = 160;
const DESCRIPTION_DANGER_AT = 175;
const DESCRIPTION_MIN = 50;

export interface SeoPreviewProps {
  /** e.g. "citycomputer.com.np/p/hp-victus-15" */
  pageUrl: string;
  pageTitle: string;
  onPageTitleChange: (value: string) => void;
  searchDescription: string;
  onSearchDescriptionChange: (value: string) => void;
  /** Used by the traffic-light hint's "mentions the product name" check. */
  productNameForHint?: string;
  /** For the Advanced settings section's website-link field. */
  slug?: string;
  canonicalOverride?: string;
  onCanonicalOverrideChange?: (value: string) => void;
  className?: string;
}

function titleCounterCopy(length: number): { text: string; className: string } {
  if (length > TITLE_DANGER_AT) {
    return {
      text: `${length} / ${TITLE_WARN_AT} — too long, Google will cut this off`,
      className: "text-danger",
    };
  }
  if (length > TITLE_WARN_AT) {
    return { text: `${length} / ${TITLE_WARN_AT} — a bit long`, className: "text-warning" };
  }
  return { text: `${length} / ${TITLE_WARN_AT}`, className: "text-on-surface-variant" };
}

function descriptionCounterCopy(length: number): { text: string; className: string } {
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
  return { text: `${length} / ${DESCRIPTION_WARN_AT}`, className: "text-on-surface-variant" };
}

export function SeoPreview({
  pageUrl,
  pageTitle,
  onPageTitleChange,
  searchDescription,
  onSearchDescriptionChange,
  productNameForHint,
  slug,
  canonicalOverride,
  onCanonicalOverrideChange,
  className,
}: SeoPreviewProps) {
  const titleCounter = titleCounterCopy(pageTitle.length);
  const descriptionCounter = descriptionCounterCopy(searchDescription.length);

  const titleOk = pageTitle.length > 0 && pageTitle.length <= TITLE_WARN_AT;
  const descriptionOk =
    searchDescription.length >= DESCRIPTION_MIN && searchDescription.length <= DESCRIPTION_WARN_AT;

  const mentionsProduct =
    !productNameForHint ||
    (pageTitle.toLowerCase().includes(productNameForHint.toLowerCase()) &&
      searchDescription.toLowerCase().includes(productNameForHint.toLowerCase()));

  const looksGood = titleOk && descriptionOk && mentionsProduct;

  const issues: string[] = [];
  if (pageTitle.length === 0) {
    issues.push("Add a page title");
  } else if (pageTitle.length > TITLE_DANGER_AT) {
    issues.push("Page title is too long");
  } else if (pageTitle.length > TITLE_WARN_AT) {
    issues.push("Page title is a bit long");
  }
  if (searchDescription.length === 0) {
    issues.push("Add a search description");
  } else if (searchDescription.length > DESCRIPTION_DANGER_AT) {
    issues.push("Search description is too long");
  } else if (searchDescription.length > DESCRIPTION_WARN_AT) {
    issues.push("Search description is a bit long");
  } else if (searchDescription.length < DESCRIPTION_MIN) {
    issues.push("Search description is a bit short");
  }
  if (
    productNameForHint &&
    pageTitle.length > 0 &&
    !pageTitle.toLowerCase().includes(productNameForHint.toLowerCase())
  ) {
    issues.push("Page title doesn't mention the product name");
  }
  if (
    productNameForHint &&
    searchDescription.length > 0 &&
    !searchDescription.toLowerCase().includes(productNameForHint.toLowerCase())
  ) {
    issues.push("Search description doesn't mention the product name");
  }

  const websiteLink = slug ? `citycomputer.com.np/p/${slug}` : pageUrl;

  return (
    <div className={cn("flex flex-col gap-6", className)}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="seo-preview-title" className="text-body-sm text-on-surface-variant">
          Page Title
        </label>
        <p className="text-body-sm text-on-surface-variant">
          The title Google shows. Keep it under {TITLE_WARN_AT} characters.
        </p>
        <Input
          id="seo-preview-title"
          value={pageTitle}
          onChange={(event) => onPageTitleChange(event.target.value)}
        />
        <span className={cn("text-label-mono-xs", titleCounter.className)}>
          {titleCounter.text}
        </span>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="seo-preview-description" className="text-body-sm text-on-surface-variant">
          Search Description
        </label>
        <p className="text-body-sm text-on-surface-variant">
          The description Google shows underneath. Keep it under {DESCRIPTION_WARN_AT} characters.
        </p>
        <Textarea
          id="seo-preview-description"
          value={searchDescription}
          onChange={(event) => onSearchDescriptionChange(event.target.value)}
          rows={3}
        />
        <span className={cn("text-label-mono-xs", descriptionCounter.className)}>
          {descriptionCounter.text}
        </span>
      </div>

      <div className="flex flex-col gap-2 rounded-lg border border-glass-stroke bg-surface p-4">
        <span className="text-label-mono-xs uppercase tracking-wide text-on-surface-variant">
          Preview
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="truncate text-[13px] text-success">{pageUrl}</span>
          <span className="truncate text-lg text-primary-container">
            {pageTitle || "Untitled page"}
          </span>
          <p className="line-clamp-2 text-body-sm text-on-surface-variant">
            {searchDescription || "No description yet."}
          </p>
        </div>
      </div>

      <p
        className={cn(
          "flex items-start gap-2 text-body-sm",
          looksGood ? "text-success" : "text-warning",
        )}
      >
        {looksGood ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        )}
        {looksGood
          ? "Looks good — your title and description are the right length and mention the product name."
          : issues.join("; ") || "Double-check the title and description above."}
      </p>

      <Accordion type="single" collapsible>
        <AccordionItem value="advanced">
          <AccordionTrigger>Only change these if someone has asked you to</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-body-sm text-on-surface-variant">Website link</span>
                <Input value={websiteLink} readOnly disabled />
              </div>
              {onCanonicalOverrideChange && (
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="seo-preview-canonical"
                    className="text-body-sm text-on-surface-variant"
                  >
                    Canonical override
                  </label>
                  <Input
                    id="seo-preview-canonical"
                    value={canonicalOverride ?? ""}
                    onChange={(event) => onCanonicalOverrideChange(event.target.value)}
                  />
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
