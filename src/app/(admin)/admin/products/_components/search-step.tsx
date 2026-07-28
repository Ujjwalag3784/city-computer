"use client";

import { SeoPreview } from "@/components/admin/seo-preview";
import type { SeoFormState } from "../_lib/wizard-types";

/**
 * Step 4 — "Search information" (docs/09-ADMIN-DAD-MODE.md §5.1). A thin
 * wrapper around the already-built `SeoPreview` component (its own doc
 * comment covers the counters/thresholds/SERP preview/traffic-light hint
 * in full) — this file's only job is computing the doc's specified
 * defaults ("Pre-filled from `{Product name} Price in Nepal | {Brand} |
 * City Computer`" / "from the short description and key specs") and
 * wiring `SeoPreview`'s controlled props to `product-wizard.tsx`'s
 * `seo` form state.
 */
export interface SearchStepProps {
  value: SeoFormState;
  onChange: (value: SeoFormState) => void;
  productName: string;
  brandName: string;
  shortDescription: string;
  slug?: string;
}

export function defaultPageTitle(productName: string, brandName: string): string {
  const parts = [productName, "Price in Nepal"];
  if (brandName) parts.push(brandName);
  parts.push("City Computer");
  return parts.filter(Boolean).join(" | ").slice(0, 70);
}

export function defaultSearchDescription(shortDescription: string): string {
  return shortDescription.slice(0, 160);
}

export function SearchStep({
  value,
  onChange,
  productName,
  brandName,
  shortDescription,
  slug,
}: SearchStepProps) {
  const pageTitle = value.metaTitle || defaultPageTitle(productName, brandName);
  const searchDescription = value.metaDescription || defaultSearchDescription(shortDescription);

  return (
    <SeoPreview
      pageUrl={slug ? `citycomputer.com.np/p/${slug}` : "citycomputer.com.np/p/..."}
      pageTitle={pageTitle}
      onPageTitleChange={(metaTitle) => onChange({ ...value, metaTitle })}
      searchDescription={searchDescription}
      onSearchDescriptionChange={(metaDescription) => onChange({ ...value, metaDescription })}
      productNameForHint={productName}
      slug={slug}
      canonicalOverride={value.canonicalOverride}
      onCanonicalOverrideChange={(canonicalOverride) => onChange({ ...value, canonicalOverride })}
    />
  );
}
