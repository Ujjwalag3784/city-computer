/**
 * The engine entry point — docs/08-PC-BUILDER-ENGINE.md §4.4's full
 * validation pass, steps 1-9, over one `Build`:
 *
 *   1. load selected parts (+ connectors)               `loadSelectedParts`
 *   2. run the power model                               `power-model.ts`
 *   3. run the connector satisfaction pass                `connector-check.ts`
 *   4. run the balance/bottleneck model                    `balance-model.ts`
 *   5. precompute cross-slot aggregates                     `build-context.ts`
 *   6. load + evaluate the active rule catalogue              `rules.ts` / `rule-engine.ts`
 *   7. add the engine's own connector-shortfall issues (not rule rows —
 *      see `rule-expression.ts`'s header comment on why connector math
 *      lives in exactly one place)
 *   8. compute a 0-100 compatibility score
 *   9. return the full report
 *
 * Performance (docs §7, "validation p95 < 300ms"): the only network calls
 * this makes are the one `db.build.findUnique` and `rules.ts`'s own
 * TTL-cached rule load — everything else (power/connector/balance/rule
 * evaluation) is synchronous, in-memory arithmetic over a build that has
 * at most ~20 selected parts and ~50 rules, which is comfortably under
 * budget on any reasonable hardware.
 */
import "server-only";
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";
import { computePowerReport, type PowerReport } from "./power-model";
import { computeConnectorBalance, type ConnectorBalanceMap } from "./connector-check";
import { computeBalanceReport, type BalanceReport, type BuildResolution } from "./balance-model";
import { buildAggregates, type SelectedPart, type BuildSettings } from "./build-context";
import { loadActiveRules } from "./rules";
import { evaluateRules, type FiredIssue } from "./rule-engine";

export interface ConnectorShortfallIssue {
  connectorType: string;
  severity: "ERROR" | "INFO";
  message: string;
  required: number;
  provided: number;
}

export interface BuildValidationReport {
  buildId: string;
  issues: FiredIssue[];
  connectorShortfalls: ConnectorShortfallIssue[];
  power: PowerReport;
  connectorBalance: ConnectorBalanceMap;
  balance: BalanceReport;
  /** Sum of every selected part's `unitPricePaisaSnapshot * quantity` — same figure `build-context.ts`'s `buildAggregates` computes for `BUILD_BUDGET_EXCEEDED` to compare against, surfaced here as a first-class field so callers (e.g. `builds.ts`'s `recomputeAndPersistTotals`) don't need to reach into the loosely-typed `aggregates` map for it. */
  totalPaisa: number;
  compatibilityScore: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  isAddToCartBlocked: boolean;
  /** `BUILD_UNVERIFIED_DATA` (docs §4.2) — a transparency note, not a rule row, since it spans every `PartType` rather than one subject/object pair; see the file doc comment on why this is computed directly instead of forcing a 16-row-per-type rule family. */
  dataConfidenceNote: string | null;
}

function humanizeConnectorType(connectorType: string): string {
  return connectorType.toLowerCase().replace(/_/g, " ");
}

/** Step 7 — a shortfall that no adapter in `connector-check.ts`'s coverage table can close is a hard ERROR (the build physically cannot be powered/connected); a shortfall an adapter *can* close is only an INFO note, since the part is still usable once its bundled adapter is used. Exported so `engine.test.ts` can exercise the full non-DB pipeline (power + connector + balance + rules + shortfalls) without needing a `Build` row. */
export function buildConnectorShortfallIssues(
  balance: ConnectorBalanceMap,
): ConnectorShortfallIssue[] {
  const issues: ConnectorShortfallIssue[] = [];
  for (const [connectorType, entry] of Object.entries(balance)) {
    if (entry.shortfall === 0) continue;
    if (entry.satisfiedWithAdapter) {
      issues.push({
        connectorType,
        severity: "INFO",
        message: `This build needs an adapter to connect its ${humanizeConnectorType(connectorType)}.`,
        required: entry.required,
        provided: entry.provided,
      });
    } else {
      issues.push({
        connectorType,
        severity: "ERROR",
        message: `Not enough ${humanizeConnectorType(connectorType)} connectors — needs ${entry.required}, has ${entry.provided}.`,
        required: entry.required,
        provided: entry.provided,
      });
    }
  }
  return issues;
}

/**
 * Compatibility score — not a formula the docs spell out numerically, so
 * this codebase's own reasonable resolution: start at 100 and deduct per
 * fired issue by severity (ERROR heaviest, INFO lightest), floored at 0.
 * A build with zero fired issues always scores 100, and a single blocking
 * ERROR drops it enough that "mostly compatible" builds still read as
 * clearly imperfect rather than rounding back up near 100.
 */
function computeCompatibilityScore(
  issues: FiredIssue[],
  connectorShortfalls: ConnectorShortfallIssue[],
): number {
  let score = 100;
  for (const issue of issues) {
    if (issue.severity === "ERROR") score -= 25;
    else if (issue.severity === "WARNING") score -= 8;
    else score -= 2;
  }
  for (const shortfall of connectorShortfalls) {
    score -= shortfall.severity === "ERROR" ? 25 : 2;
  }
  return Math.max(0, score);
}

/** `BUILD_UNVERIFIED_DATA` — one summary note (not one issue per part) so a build with several `INFERRED` specs doesn't drown its real ERROR/WARNING issues in repeated transparency notices. */
function buildDataConfidenceNote(parts: SelectedPart[]): string | null {
  const unverified = parts.filter((p) => p.part.dataConfidence !== "VERIFIED");
  if (unverified.length === 0) return null;
  const names = unverified.map((p) => p.part.model).join(", ");
  const plural = unverified.length === 1;
  return `${unverified.length} part${plural ? "" : "s"} in this build ${plural ? "has" : "have"} unverified or inferred specs (${names}) — double-check against the manufacturer before ordering.`;
}

/** Loads a `Build`'s `BuildItem`s (+ their `ComponentPart` + `PartConnector` rows) and shapes them into `SelectedPart[]`. Throws `NotFoundError` if the build doesn't exist — callers (Server Actions, the `/build/[shortId]` page) are expected to turn that into a 404. */
export async function loadSelectedParts(
  buildId: string,
): Promise<{ parts: SelectedPart[]; settings: BuildSettings }> {
  const build = await db.build.findUnique({
    where: { id: buildId },
    include: {
      items: {
        include: {
          part: { include: { connectors: true } },
        },
      },
    },
  });
  if (!build) throw new NotFoundError("Build");

  const parts: SelectedPart[] = build.items.map((item) => ({
    slotKey: item.slotKey,
    quantity: item.quantity,
    isUserSelected: item.isUserSelected,
    unitPricePaisaSnapshot: item.unitPricePaisaSnapshot,
    part: {
      id: item.part.id,
      partType: item.part.partType,
      manufacturer: item.part.manufacturer,
      model: item.part.model,
      specs: item.part.specs,
      performanceTier: item.part.performanceTier,
      benchmarkScore: item.part.benchmarkScore,
      tdpWatts: item.part.tdpWatts,
      idleWatts: item.part.idleWatts,
      loadWatts: item.part.loadWatts,
      transientMultiplier: item.part.transientMultiplier,
      lengthMm: item.part.lengthMm,
      widthMm: item.part.widthMm,
      heightMm: item.part.heightMm,
      dataConfidence: item.part.dataConfidence,
      connectors: item.part.connectors.map((c) => ({
        direction: c.direction,
        connectorType: c.connectorType,
        quantity: c.quantity,
      })),
    },
  }));

  const settings: BuildSettings = {
    useCase: build.useCase,
    targetResolution: build.targetResolution,
    budgetPaisa: build.budgetPaisa,
  };

  return { parts, settings };
}

/** Runs the full §4.4 pass. This is the one function every caller (Server Actions, `/build/[shortId]`, the admin rule tester) should use — nothing outside this file should call the individual models directly for a real build, so the pipeline order above is never duplicated or drifted between callers. */
export async function validateBuild(buildId: string): Promise<BuildValidationReport> {
  const { parts, settings } = await loadSelectedParts(buildId);

  const power = computePowerReport(parts);
  const connectorBalance = computeConnectorBalance(parts);
  const balance = computeBalanceReport(parts, settings.targetResolution as BuildResolution);
  const aggregates = buildAggregates(parts, power, connectorBalance, balance);

  const rules = await loadActiveRules();
  const issues = evaluateRules(rules, parts, aggregates, settings);
  const connectorShortfalls = buildConnectorShortfallIssues(connectorBalance);

  const errorCount =
    issues.filter((i) => i.severity === "ERROR").length +
    connectorShortfalls.filter((s) => s.severity === "ERROR").length;
  const warningCount = issues.filter((i) => i.severity === "WARNING").length;
  const dataConfidenceNote = buildDataConfidenceNote(parts);
  const infoCount =
    issues.filter((i) => i.severity === "INFO").length +
    connectorShortfalls.filter((s) => s.severity === "INFO").length +
    (dataConfidenceNote ? 1 : 0);

  return {
    buildId,
    issues,
    connectorShortfalls,
    power,
    connectorBalance,
    balance,
    totalPaisa: (aggregates.totalPaisa as number | undefined) ?? 0,
    compatibilityScore: computeCompatibilityScore(issues, connectorShortfalls),
    errorCount,
    warningCount,
    infoCount,
    isAddToCartBlocked: issues.some((i) => i.isBlocking && i.severity === "ERROR"),
    dataConfidenceNote,
  };
}
