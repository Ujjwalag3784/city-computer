import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/errors";
import { getBuildByShortId, incrementBuildViewCount } from "@/server/services/builder/builds";
import { validateBuild } from "@/server/services/builder/validate-build";
import { BuildShareView } from "./_components/build-share-view";

interface BuildPageProps {
  params: Promise<{ shortId: string }>;
}

// docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md §4.2 Step 10: "shareable;
// noindex by default" — a shared build is reachable by anyone with the
// link but never indexed, same treatment as the order-tracking page.
export const metadata: Metadata = {
  title: "Shared PC build — City Computer Systems",
  robots: { index: false, follow: true },
};

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
    </div>
  );
}
