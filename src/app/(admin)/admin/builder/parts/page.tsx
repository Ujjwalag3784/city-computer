import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { requirePermission } from "@/server/auth/permissions";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { AdminSearchBox } from "@/components/admin/admin-search-box";
import { listBuildablePartsForAdmin } from "@/server/services/admin/builder-parts";
import type { PartType, PartDataConfidence } from "@/generated/prisma/client";
import { BuilderPartsFilterBar } from "./_components/builder-parts-filter-bar";
import { BuildablePartsTable } from "./_components/buildable-parts-table";

export const metadata: Metadata = {
  title: "Buildable Parts — Admin — City Computer Systems",
};

const VALID_PART_TYPES = new Set<string>([
  "CPU",
  "CPU_COOLER",
  "MOTHERBOARD",
  "RAM",
  "GPU",
  "STORAGE",
  "PSU",
  "CASE",
  "CASE_FAN",
  "MONITOR",
  "OS",
  "CAPTURE_CARD",
  "SOUND_CARD",
  "NETWORK_CARD",
  "THERMAL_PASTE",
  "ACCESSORY",
]);
const VALID_CONFIDENCE = new Set<string>(["VERIFIED", "INFERRED", "UNVERIFIED"]);

/**
 * `/admin/builder/parts` — docs §10's "Buildable Parts" list (Task #76,
 * built only if 1-5 landed solid first, per this session's own priority
 * order). Read-only this pass: filter by part type + data confidence,
 * search by manufacturer/model. Creating/editing a `ComponentPart` still
 * only happens by hand in the seed file — see `builder-parts.ts`'s own
 * header comment.
 */
export default async function AdminBuilderPartsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const session = await auth();
  try {
    requirePermission(session?.user ?? null, "builder-part:write");
  } catch (error) {
    if (error instanceof UnauthenticatedError) {
      redirect("/auth/login?callbackUrl=/admin/builder/parts");
    }
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const q = typeof params.q === "string" ? params.q : undefined;
  const partTypeParam = typeof params.partType === "string" ? params.partType : undefined;
  const confidenceParam = typeof params.confidence === "string" ? params.confidence : undefined;

  const partType =
    partTypeParam && VALID_PART_TYPES.has(partTypeParam) ? (partTypeParam as PartType) : undefined;
  const dataConfidence =
    confidenceParam && VALID_CONFIDENCE.has(confidenceParam)
      ? (confidenceParam as PartDataConfidence)
      : undefined;

  const rows = await listBuildablePartsForAdmin({ partType, dataConfidence, q });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-headline-md text-on-surface">Buildable Parts</h1>
        <p className="max-w-[65ch] text-body-sm text-on-surface-variant">
          Every ComponentPart the PC Builder&apos;s compatibility engine can reason about. Filter by
          part type or by how confident we are in a part&apos;s specs before trusting a rule against
          it.
        </p>
        <Link href="/admin/builder/rules" className="text-body-sm text-primary underline">
          Go to Rule Tester →
        </Link>
      </div>

      <AdminSearchBox initialValue={q ?? ""} placeholder="Search manufacturer or model..." />
      <BuilderPartsFilterBar />

      <BuildablePartsTable rows={rows} />

      <p className="text-body-sm text-on-surface-variant">
        {rows.length} part{rows.length === 1 ? "" : "s"}
      </p>
    </div>
  );
}
