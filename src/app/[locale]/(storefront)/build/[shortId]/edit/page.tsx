import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { NotFoundError } from "@/lib/errors";
import { getBuildByShortId, isBuildOwner } from "@/server/services/builder/builds";
import { validateBuild } from "@/server/services/builder/validate-build";
import { getSelectedPartRows } from "@/server/services/builder/part-picker";
import { BuilderEditView } from "./_components/builder-edit-view";

interface BuildEditPageProps {
  params: Promise<{ shortId: string }>;
}

// Never indexed — this is the owner-only editing surface, not the public
// share page (`/build/[shortId]` already carries its own noindex).
export const metadata: Metadata = {
  title: "Edit your PC build — City Computer Systems",
  robots: { index: false, follow: false },
};

/**
 * `/build/[shortId]/edit` — Task #73's builder workspace: the slot grid,
 * mode switcher, virtualized part picker, compatibility panel with Fix
 * drawers, and summary panel all live in `BuilderEditView` below; this
 * Server Component only does the ownership gate and the two initial reads.
 *
 * Ownership: ANY visitor can view `/build/[shortId]` (the read-only share
 * page), but only the build's owner (customer or anonymous
 * `city_build_owner` cookie holder — see `builds.ts`'s own header comment)
 * may reach this editing surface. A non-owner is redirected to the
 * read-only share view rather than shown a 403 — the docs never describe
 * an error page for this case, and "redirect to the thing you CAN see"
 * is the friendlier of the two options for someone who followed a shared
 * link expecting to look, not edit.
 *
 * `getSelectedPartRows` (not `getBuildByShortId`'s own `items.part` alone)
 * is what supplies each filled slot's `PartRowData` — see that function's
 * own doc comment on why a dedicated loader exists instead of re-deriving
 * display data from the bare `ComponentPart` columns `getBuildByShortId`
 * already includes.
 */
export default async function BuildEditPage({ params }: BuildEditPageProps) {
  const { shortId } = await params;

  let build: Awaited<ReturnType<typeof getBuildByShortId>>;
  try {
    build = await getBuildByShortId(shortId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }

  const session = await auth();
  const identity = { userId: session?.user?.id, userEmail: session?.user?.email ?? null };
  const owns = await isBuildOwner(build, identity);
  if (!owns) redirect(`/build/${shortId}`);

  const [report, partRows] = await Promise.all([
    validateBuild(build.id),
    getSelectedPartRows(build.id),
  ]);

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-8 sm:px-6 lg:px-8">
      <BuilderEditView build={build} initialReport={report} initialPartRows={partRows} />
    </div>
  );
}
