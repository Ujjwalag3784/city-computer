/**
 * `/admin/builder/parts` — docs/08-PC-BUILDER-ENGINE.md §10's "Buildable
 * Parts" admin surface, narrowed this pass to a read-only filterable list
 * (filter by `partType` + `dataConfidence`, per this session's own scope
 * note). Creating/editing a `ComponentPart` — authoring its per-`PartType`
 * `specs` JSON through a real form, not by hand in the seed file or
 * directly in the database — is real, described admin scope this pass
 * doesn't attempt; flagged in PROGRESS.md rather than silently dropped.
 */
import "server-only";
import { db } from "@/server/db";
import type { PartType, PartDataConfidence } from "@/generated/prisma/client";

export interface AdminBuildablePartRow {
  id: string;
  partType: PartType;
  manufacturer: string;
  model: string;
  performanceTier: number;
  dataConfidence: PartDataConfidence;
  isActive: boolean;
  /** True when this part has a linked `Variant` (a real, purchasable SKU) rather than being informational-only — see `part-image.ts`'s own note on why most seeded parts don't have one yet. */
  isSellable: boolean;
}

export interface ListBuildablePartsQuery {
  partType?: PartType;
  dataConfidence?: PartDataConfidence;
  q?: string;
}

export async function listBuildablePartsForAdmin(
  query: ListBuildablePartsQuery,
): Promise<AdminBuildablePartRow[]> {
  const trimmedQuery = query.q?.trim();

  const rows = await db.componentPart.findMany({
    where: {
      partType: query.partType,
      dataConfidence: query.dataConfidence,
      ...(trimmedQuery
        ? {
            OR: [
              { manufacturer: { contains: trimmedQuery, mode: "insensitive" } },
              { model: { contains: trimmedQuery, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      partType: true,
      manufacturer: true,
      model: true,
      performanceTier: true,
      dataConfidence: true,
      isActive: true,
      variantId: true,
    },
    orderBy: [{ partType: "asc" }, { manufacturer: "asc" }, { model: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    partType: row.partType,
    manufacturer: row.manufacturer,
    model: row.model,
    performanceTier: row.performanceTier,
    dataConfidence: row.dataConfidence,
    isActive: row.isActive,
    isSellable: row.variantId !== null,
  }));
}
