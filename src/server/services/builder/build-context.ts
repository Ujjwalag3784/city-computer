/**
 * Build context — turns a build's selected `ComponentPart` rows into the
 * two shapes the rest of the engine needs: `SelectedPart[]` (the plain
 * list `power-model.ts`/`connector-check.ts`/`balance-model.ts` iterate
 * over) and, once those three have run, a `RuleRefContext` per
 * subject/object pair for `rule-expression.ts`'s `evaluateRuleExpression`
 * — docs/08-PC-BUILDER-ENGINE.md §4.4 steps 1-3.
 *
 * This module does not itself run the power/connector/balance
 * computations — `validate-build.ts` (the orchestrator) calls those
 * directly and passes the results in here, so each model stays testable
 * in isolation and this file's only job is shaping data, not computing
 * it.
 */
import "server-only";
import type { PartType, ConnectorDirection, ConnectorType } from "@/generated/prisma/client";
import type { RuleRefContext } from "./rule-expression";
import type { PowerReport } from "./power-model";
import type { ConnectorBalanceMap } from "./connector-check";
import type { BalanceReport } from "./balance-model";

/** The subset of `ComponentPart` + its `PartConnector` rows every model in this phase actually reads. Deliberately narrower than the full Prisma type so test fixtures can build one by hand without a database. */
export interface SelectedPartRecord {
  id: string;
  partType: PartType;
  manufacturer: string;
  model: string;
  specs: unknown;
  performanceTier: number | null;
  benchmarkScore: number | null;
  tdpWatts: number | null;
  idleWatts: number | null;
  loadWatts: number | null;
  transientMultiplier: number | null;
  lengthMm: number | null;
  widthMm: number | null;
  heightMm: number | null;
  dataConfidence: "VERIFIED" | "INFERRED" | "UNVERIFIED";
  connectors: Array<{
    direction: ConnectorDirection;
    connectorType: ConnectorType;
    quantity: number;
  }>;
}

export interface SelectedPart {
  slotKey: string;
  quantity: number;
  isUserSelected: boolean;
  /** `BuildItem.unitPricePaisaSnapshot` — carried here (rather than re-reading `Product`/`ProductVariant` pricing) because a saved build intentionally shows what it cost *at save time*, per `Build`'s own doc comment ("Prices at save time, so a shared build shows what it cost then"). */
  unitPricePaisaSnapshot: number;
  part: SelectedPartRecord;
}

export interface BuildSettings {
  useCase: string;
  targetResolution: string;
  budgetPaisa: number | null;
}

const STORAGE_SLOT_PREFIX = "storage";
const CASE_FAN_SLOT_PREFIX = "case_fan";

function slotsMatchingPrefix(parts: SelectedPart[], prefix: string): SelectedPart[] {
  return parts.filter((p) => p.slotKey === prefix || p.slotKey.startsWith(`${prefix}_`));
}

function specValue(specs: unknown, key: string): unknown {
  if (typeof specs !== "object" || specs === null) return undefined;
  // eslint-disable-next-line security/detect-object-injection -- `key` is always a literal spec field name passed by this file's own callers, never user input.
  return (specs as Record<string, unknown>)[key];
}

/**
 * Precomputes the cross-slot aggregates the rule catalogue references as
 * `build.*` — this is the "handful of real aggregates" `rule-expression.ts`'s
 * own header comment promises rather than a generic query language. Power,
 * connector, and balance figures are folded in verbatim from the three
 * dedicated models so a rule can compare against e.g. `build.peakLoadWatts`
 * with a plain `GTE`.
 */
export function buildAggregates(
  parts: SelectedPart[],
  power: PowerReport,
  connectorBalance: ConnectorBalanceMap,
  balance: BalanceReport | null,
): Record<string, unknown> {
  const storageDrives = slotsMatchingPrefix(parts, STORAGE_SLOT_PREFIX);
  const caseFans = slotsMatchingPrefix(parts, CASE_FAN_SLOT_PREFIX);
  const motherboard = parts.find((p) => p.slotKey === "motherboard");
  const cpu = parts.find((p) => p.slotKey === "cpu");
  const gpu = parts.find((p) => p.slotKey === "gpu");
  const psu = parts.find((p) => p.slotKey === "psu");
  const pcCase = parts.find((p) => p.slotKey === "case");
  const cooler = parts.find((p) => p.slotKey === "cpu_cooler");
  const ramSticks = slotsMatchingPrefix(parts, "ram");
  const expansionCards = slotsMatchingPrefix(parts, "expansion");

  // Form factors/interfaces per `storageFormFactorSchema`/`storageInterfaceSchema`
  // in part-specs.ts — M2_2280/M2_2242/M2_22110 for NVMe, SATA_2_5/SATA_3_5
  // for SATA drives (interface "SATA3" either way).
  const m2DriveCount = storageDrives.filter((d) => {
    const formFactor = specValue(d.part.specs, "formFactor");
    return formFactor === "M2_2280" || formFactor === "M2_2242" || formFactor === "M2_22110";
  }).length;
  // 2.5" SATA drives — compared against `CaseSpec.driveBays.ssd25`.
  const sataDriveCount = storageDrives.filter(
    (d) => specValue(d.part.specs, "formFactor") === "SATA_2_5",
  ).length;
  // 3.5" drives (SATA HDDs) — compared against `CaseSpec.driveBays.hdd35`.
  const hddCount = storageDrives.filter(
    (d) => specValue(d.part.specs, "formFactor") === "SATA_3_5",
  ).length;
  // Every drive that actually occupies a motherboard SATA port, regardless
  // of its physical bay size — this is the figure `STORAGE_SATA_PORTS`
  // compares against `MotherboardSpec.sataPorts`, distinct from the
  // bay-size-specific counts above (a board could run out of SATA ports
  // before a case runs out of 2.5"/3.5" bays, or vice versa).
  const sataInterfaceDriveCount = storageDrives.filter(
    (d) => specValue(d.part.specs, "interface") === "SATA3",
  ).length;

  const m2SlotsTotal = Array.isArray(specValue(motherboard?.part.specs, "m2Slots"))
    ? (specValue(motherboard?.part.specs, "m2Slots") as unknown[]).length
    : 0;
  const ramSlotsTotal =
    typeof specValue(motherboard?.part.specs, "ramSlots") === "number"
      ? (specValue(motherboard?.part.specs, "ramSlots") as number)
      : 0;
  const sataPortsTotal =
    typeof specValue(motherboard?.part.specs, "sataPorts") === "number"
      ? (specValue(motherboard?.part.specs, "sataPorts") as number)
      : 0;

  const totalPaisa = parts.reduce((sum, p) => sum + p.unitPricePaisaSnapshot * p.quantity, 0);

  return {
    totalPaisa,
    storageCount: storageDrives.length,
    m2DriveCount,
    sataDriveCount,
    hddCount,
    sataInterfaceDriveCount,
    totalFanCount: caseFans.reduce((sum, fan) => sum + fan.quantity, 0),
    expansionCardCount: expansionCards.length,
    ramStickCount: ramSticks.reduce((sum, r) => sum + r.quantity, 0),
    freeM2Slots: Math.max(0, m2SlotsTotal - m2DriveCount),
    freeRamSlots: Math.max(0, ramSlotsTotal - ramSticks.reduce((sum, r) => sum + r.quantity, 0)),
    freeSataPorts: Math.max(0, sataPortsTotal - sataDriveCount),
    hasCpu: Boolean(cpu),
    hasMotherboard: Boolean(motherboard),
    hasGpu: Boolean(gpu),
    hasPsu: Boolean(psu),
    hasCase: Boolean(pcCase),
    hasCooler: Boolean(cooler),
    baseLoadWatts: power.baseLoadWatts,
    peakLoadWatts: power.peakLoadWatts,
    recommendedPsuWatts: power.recommendedPsuWatts,
    selectedPsuWatts: power.selectedPsuWatts,
    powerVerdict: power.verdict,
    connectorBalance,
    balanceScore: balance?.adjustedBalance ?? null,
    balanceVerdict: balance?.verdict ?? null,
    cpuScore: balance?.cpuScore ?? null,
    gpuScore: balance?.gpuScore ?? null,
  };
}

/**
 * Builds the `RuleRefContext` for one (subject, object) pair — `build.*`
 * carries the precomputed aggregates, `context.*` carries the build's own
 * settings (use case / resolution / budget), matching the four ref
 * namespaces docs §4.1 defines (`subject`, `object`, `build`, `context`).
 */
export function contextForPair(
  subject: SelectedPart,
  object: SelectedPart,
  aggregates: Record<string, unknown>,
  settings: BuildSettings,
): RuleRefContext {
  return {
    subject: { ...subject.part, quantity: subject.quantity, slotKey: subject.slotKey },
    object: { ...object.part, quantity: object.quantity, slotKey: object.slotKey },
    build: aggregates,
    context: {
      useCase: settings.useCase,
      targetResolution: settings.targetResolution,
      budgetPaisa: settings.budgetPaisa,
    },
  };
}

/** All parts in the build matching a given `PartType` — a rule's subject/object type maps to zero, one, or several selected parts (e.g. multiple `STORAGE` drives across `storage_1..4`). */
export function partsOfType(parts: SelectedPart[], partType: PartType): SelectedPart[] {
  return parts.filter((p) => p.part.partType === partType);
}
