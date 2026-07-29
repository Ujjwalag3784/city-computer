import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { buildWebApplicationJsonLd } from "@/lib/seo/jsonld/web-application";
import { buildCanonical, buildHreflangAlternates } from "@/lib/seo/metadata";
import { NewBuildForm } from "./_components/new-build-form";

const HAS_NE_TRANSLATION = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "Start a PC build — City Computer Systems",
    alternates: {
      canonical: buildCanonical("/build/new", locale),
      languages: buildHreflangAlternates("/build/new", { ne: HAS_NE_TRANSLATION }),
    },
  };
}

/**
 * `/build/new` — Task #73's entry point into the PC Builder. Captures the
 * handful of settings `Build` itself stores (`mode`, `useCase`,
 * `targetResolution`, `budgetPaisa`) via `createBuildAction`, then the
 * client form redirects to `/build/{shortId}/edit` to fill in parts.
 *
 * FLAGGED SIMPLIFICATION: docs §9's Guided mode is "6 questions in plain
 * language -> a complete validated build -> review and swap" — an
 * auto-build/solver that picks every slot for the shopper. This form
 * collects the same four inputs regardless of which mode is chosen
 * (mode only changes how `/build/[shortId]/edit` *presents* the slot grid
 * afterwards, per `ModeSelect`'s own doc comment that mode is "switchable
 * at any time without losing the build"); no solver runs here or anywhere
 * in this pass. Flagged in PROGRESS.md, not silently narrowed.
 */
export default async function NewBuildPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return (
    <div className="mx-auto max-w-[640px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Start a PC build</h1>
        <p className="text-body-sm text-on-surface-variant">
          Pick a mode and tell us roughly what this build is for — you can change any of this later
          without losing your progress.
        </p>
      </div>
      <NewBuildForm />

      <JsonLd
        data={buildWebApplicationJsonLd({
          pathname: "/build/new",
          locale,
          name: "City Computer Systems PC Builder",
          description: "Build a custom PC step by step, with real compatibility checking.",
          applicationCategory: "UtilitiesApplication",
        })}
      />
    </div>
  );
}
