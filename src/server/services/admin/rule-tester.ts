/**
 * `/admin/builder/rules` — docs/08-PC-BUILDER-ENGINE.md §10's "Rule
 * Tester": "pick sample parts per slot, run the engine, see which rules
 * fired" — for a technician/owner to sanity-check a rule (or a new part's
 * specs) without creating a real `Build` row. This reuses the exact same
 * `evaluateSelectedParts` pipeline `validate-build.ts`/`part-picker.ts`
 * already call — never a second, drifted copy of the compatibility logic
 * — by constructing an in-memory `SelectedPart[]` out of admin-picked
 * `ComponentPart` ids instead of a persisted `BuildItem` list.
 *
 * Narrowed to this pass's 8 core `SLOT_MODEL` slots, same simplification
 * as the rest of this pass's builder UI (see `src/lib/builder/slots.ts`'s
 * own header comment) — a technician testing a rule against, say,
 * `case_fan_3` isn't supported this pass.
 */
import "server-only";
import { db } from "@/server/db";
import { SLOT_MODEL } from "@/lib/builder/slots";
import {
  evaluateSelectedParts,
  type SelectedPart,
  type BuildValidationReport,
} from "@/server/services/builder/validate-build";

export interface RuleTesterPartOption {
  id: string;
  manufacturer: string;
  model: string;
}

/** `slotKey -> every active part of that slot's PartType`, for populating the tester's 8 per-slot dropdowns. */
export async function listRuleTesterPartOptions(): Promise<Record<string, RuleTesterPartOption[]>> {
  const options: Record<string, RuleTesterPartOption[]> = {};
  for (const slot of SLOT_MODEL) {
    const parts = await db.componentPart.findMany({
      where: { partType: slot.partType, isActive: true },
      select: { id: true, manufacturer: true, model: true },
      orderBy: [{ manufacturer: "asc" }, { model: "asc" }],
    });
    // `slot.slotKey` comes from this file's own imported `SLOT_MODEL` constant, never arbitrary input.
    options[slot.slotKey] = parts;
  }
  return options;
}

/**
 * `selections` is a `slotKey -> ComponentPart.id` map (a slot left
 * unselected is simply absent) — this loads each selected part's full
 * `SelectedPartRecord` shape (including `connectors`, mirroring
 * `validate-build.ts`'s own `loadSelectedParts`) and hands the whole
 * hypothetical build to the real engine. `unitPricePaisaSnapshot` is
 * always 0 here (there is no real `BuildItem` to snapshot a price from —
 * the Rule Tester only cares about compatibility, not pricing), and
 * `isUserSelected` is always `true`. `settings` defaults to a neutral
 * GENERAL/FHD/no-budget profile — the Rule Tester is about compatibility,
 * not the use-case/budget rules that only ever produce WARNING/INFO
 * fit-advice anyway.
 */
export async function runRuleTester(
  selections: Record<string, string>,
): Promise<BuildValidationReport> {
  const partIds = Object.values(selections).filter((id): id is string => Boolean(id));
  const parts = partIds.length
    ? await db.componentPart.findMany({
        where: { id: { in: partIds } },
        include: { connectors: true },
      })
    : [];
  const partsById = new Map(parts.map((part) => [part.id, part]));

  const selectedParts: SelectedPart[] = [];
  for (const slot of SLOT_MODEL) {
    // `slot.slotKey` comes from this file's own imported `SLOT_MODEL` constant.
    const partId = selections[slot.slotKey];
    if (!partId) continue;
    const part = partsById.get(partId);
    if (!part) continue;
    selectedParts.push({
      slotKey: slot.slotKey,
      quantity: 1,
      isUserSelected: true,
      unitPricePaisaSnapshot: 0,
      part: {
        id: part.id,
        partType: part.partType,
        manufacturer: part.manufacturer,
        model: part.model,
        specs: part.specs,
        performanceTier: part.performanceTier,
        benchmarkScore: part.benchmarkScore,
        tdpWatts: part.tdpWatts,
        idleWatts: part.idleWatts,
        loadWatts: part.loadWatts,
        transientMultiplier: part.transientMultiplier,
        lengthMm: part.lengthMm,
        widthMm: part.widthMm,
        heightMm: part.heightMm,
        dataConfidence: part.dataConfidence,
        connectors: part.connectors.map((c) => ({
          direction: c.direction,
          connectorType: c.connectorType,
          quantity: c.quantity,
        })),
      },
    });
  }

  return evaluateSelectedParts("admin-rule-tester", selectedParts, {
    useCase: "GENERAL",
    targetResolution: "FHD",
    budgetPaisa: null,
  });
}
