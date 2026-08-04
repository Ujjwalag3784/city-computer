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
import { computeSeoHint, DESCRIPTION_WARN_AT, TITLE_WARN_AT } from "@/lib/seo/serp-hint";
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
 * All of the threshold math (docs/11-SEO-STRATEGY.md §3's length-budget
 * table) and the traffic-light verdict live in `src/lib/seo/serp-hint.ts`,
 * a plain function with its own unit tests — this component only wires
 * that verdict into JSX. It used to duplicate the threshold constants
 * inline (and had drifted from the doc — see PROGRESS.md Phase 11); this
 * is the fix, not a rewrite of the underlying decision.
 *
 * The Google SERP mock below the fields is a deliberate one-off visual
 * reference to a real Google search result — not part of the Obsidian Peak
 * component system — so it's styled to loosely resemble an actual SERP
 * entry rather than reusing token-driven card styles, and is labelled with
 * a small "Preview" eyebrow so it doesn't read as a broken/unstyled
 * component.
 */
export interface SeoPreviewProps {
  /** e.g. "citycomputer.com.np/p/hp-victus-15" */
  pageUrl: string;
  pageTitle: string;
  onPageTitleChange: (value: string) => void;
  searchDescription: string;
  onSearchDescriptionChange: (value: string) => void;
  /** Used by the traffic-light hint's "mentions the product name" check. */
  productNameForHint?: string;
  canonicalOverride?: string;
  onCanonicalOverrideChange?: (value: string) => void;
  className?: string;
}

export function SeoPreview({
  pageUrl,
  pageTitle,
  onPageTitleChange,
  searchDescription,
  onSearchDescriptionChange,
  productNameForHint,
  canonicalOverride,
  onCanonicalOverrideChange,
  className,
}: SeoPreviewProps) {
  const hint = computeSeoHint({
    title: pageTitle,
    description: searchDescription,
    entityName: productNameForHint,
  });

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
        <span className={cn("text-label-mono-xs", hint.titleCounter.className)}>
          {hint.titleCounter.text}
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
        <span className={cn("text-label-mono-xs", hint.descriptionCounter.className)}>
          {hint.descriptionCounter.text}
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
          hint.looksGood ? "text-success" : "text-warning",
        )}
      >
        {hint.looksGood ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        ) : (
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        )}
        {hint.looksGood
          ? "Looks good — your title and description are the right length and mention the product name."
          : hint.issues.join("; ") || "Double-check the title and description above."}
      </p>

      <Accordion type="single" collapsible>
        <AccordionItem value="advanced">
          <AccordionTrigger>Only change these if someone has asked you to</AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <span className="text-body-sm text-on-surface-variant">Website link</span>
                <Input value={pageUrl} readOnly disabled />
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
