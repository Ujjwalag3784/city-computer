"use client";

import { SeoPreview } from "@/components/admin/seo-preview";
import type { SeoFormState } from "../_lib/wizard-types";
import { defaultPageTitle, defaultSearchDescription } from "../_lib/seo-defaults";
import { SITE_HOST } from "@/lib/client/site-host";

export { defaultPageTitle, defaultSearchDescription };

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

export function SearchStep({
  value,
  onChange,
  productName,
  brandName,
  shortDescription,
  slug,
}: SearchStepProps) {
  const pageTitle = value.metaTitle || defaultPageTitle(productName, brandName);
  const searchDescription =
    value.metaDescription || defaultSearchDescription(productName, shortDescription);

  return (
    <SeoPreview
      pageUrl={slug ? `${SITE_HOST}/p/${slug}` : `${SITE_HOST}/p/...`}
      pageTitle={pageTitle}
      onPageTitleChange={(metaTitle) => onChange({ ...value, metaTitle })}
      searchDescription={searchDescription}
      onSearchDescriptionChange={(metaDescription) => onChange({ ...value, metaDescription })}
      productNameForHint={productName}
      canonicalOverride={value.canonicalOverride}
      onCanonicalOverrideChange={(canonicalOverride) => onChange({ ...value, canonicalOverride })}
    />
  );
}
