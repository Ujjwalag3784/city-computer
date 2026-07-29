import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/seo/json-ld";
import { buildBuildProductJsonLd } from "@/lib/seo/jsonld/build-product";
import { buildCanonical } from "@/lib/seo/metadata";
import { absoluteAssetUrl } from "@/lib/seo/site";
import { NotFoundError } from "@/lib/errors";
import { getBuildByShortId, incrementBuildViewCount } from "@/server/services/builder/builds";
import { validateBuild } from "@/server/services/builder/validate-build";
import { BuildShareView } from "./_components/build-share-view";

interface BuildPageProps {
  params: Promise<{ locale: string; shortId: string }>;
}

/**
 * docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md §4.2 Step 10 / docs/11-SEO-
 * STRATEGY.md §4.11: "shareable; noindex by default" — a shared build is
 * reachable by anyone with the link but never indexed. This is also this
 * codebase's real answer to Phase 11's "programmatic pages behind a
 * review queue" deliverable: `Build.visibility` (`BuildVisibility`:
 * `PRIVATE`/`UNLISTED`/`PUBLIC`, default `UNLISTED`) is exactly that gate
 * — a build is never indexable until an owner explicitly promotes it, at
 * which point (per the doc) it becomes a real curated `/p/[slug]` Product
 * with its own copy and photos, not this page becoming indexable in
 * place. No new page type/model was invented for this deliverable; see
 * PROGRESS.md Phase 11 for the full scoping note.
 */
export async function generateMetadata({ params }: BuildPageProps): Promise<Metadata> {
  const { locale, shortId } = await params;
  return {
    title: "Shared PC build — City Computer Systems",
    alternates: { canonical: buildCanonical(`/build/${shortId}`, locale) },
    robots: { index: false, follow: true },
  };
}

/**
 * `/build/[shortId]` — docs/08-PC-BUILDER-ENGINE.md §11's shareable build
 * page: parts with specs, price then vs. now, compatibility verdict,
 * power and balance, "Add to cart". "Clone this build" and the
 * owner's-display-name option are both real docs §11 scope not wired
 * this pass — flagged in PROGRESS.md rather than faked.
 *
 * Server Component: the build + a fresh `validateBuild` run (never a
 * stale cached snapshot — see `builds.ts`'s own note on why
 * `BuildValidationSnapshot` isn't written/read yet) happen here; the
 * "Add to cart"/"Share" interactivity is delegated to the client
 * component below.
 */
export default async function BuildSharePage({ params }: BuildPageProps) {
  const { shortId } = await params;

  let build: Awaited<ReturnType<typeof getBuildByShortId>>;
  try {
    build = await getBuildByShortId(shortId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  void incrementBuildViewCount(build.id);
  const report = await validateBuild(build.id);

  return (
    <div className="mx-auto max-w-[960px] px-4 py-8 sm:px-6 lg:px-8">
      <BuildShareView build={build} report={report} />

      {/*
        Markup is still emitted even though this page is noindex — docs/11
        §4.11: "still emitted for social/AI unfurling and for the curated
        exception." `parts: []` (no `isRelatedTo` product links) is a
        deliberate, flagged scope cut: resolving each ComponentPart's
        linked Variant -> Product slug would need an extra join this pass
        didn't add — see PROGRESS.md Phase 11.
      */}
      <JsonLd
        data={buildBuildProductJsonLd({
          shortId,
          name: build.name ?? "Custom PC Build",
          description:
            build.description ?? "A custom PC build configured on City Computer Systems.",
          imageUrl: absoluteAssetUrl(`/build/${shortId}/opengraph-image`),
          totalPricePaisa: build.totalPaisa ?? 0,
          availability: "InStock",
          parts: [],
        })}
      />
    </div>
  );
}
