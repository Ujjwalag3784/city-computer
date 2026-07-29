"use client";

import * as React from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { ModeSelect, type BuilderMode } from "@/components/builder/mode-select";
import { BuilderSlotCard, type BuilderSlotState } from "@/components/builder/builder-slot-card";
import { PartPickerDrawer } from "@/components/builder/part-picker-drawer";
import { FixDrawer } from "@/components/builder/fix-drawer";
import { CompatibilityPanel } from "@/components/builder/compatibility-panel";
import { IssueRow, type IssueSeverity } from "@/components/builder/issue-row";
import { BuildSummaryPanel } from "@/components/builder/build-summary-panel";
import { BuildShareDialog } from "@/components/builder/build-share-dialog";
import { StepRail, type BuilderStepInfo } from "@/components/builder/step-rail";
import type { PartRowData } from "@/components/builder/part-row";
import {
  SLOT_MODEL,
  findSlotDefinition,
  slotLabel,
  type BuilderSlotDefinition,
} from "@/lib/builder/slots";
import { cn } from "@/lib/utils";
import type { getBuildByShortId } from "@/server/services/builder/builds";
import type { BuildValidationReport } from "@/server/services/builder/validate-build";
import type { CandidatePartRow } from "@/server/services/builder/part-picker";
import {
  setBuildItemAction,
  removeBuildItemAction,
  setBuildModeAction,
  listPartsForSlotAction,
  listPartsForSlotWithDeltaAction,
  addBuildToCartAction,
} from "../../../_actions";

type BuildWithItems = Awaited<ReturnType<typeof getBuildByShortId>>;

export interface BuilderEditViewProps {
  build: BuildWithItems;
  initialReport: BuildValidationReport;
  /** `slotKey -> PartRowData` for every part currently in the build — see `getSelectedPartRows`'s own doc comment for why this is a dedicated loader rather than derived from `build.items` in this file. */
  initialPartRows: Record<string, PartRowData>;
}

const MODE_TO_ENUM: Record<BuilderMode, "GUIDED" | "STANDARD" | "EXPERT"> = {
  guided: "GUIDED",
  standard: "STANDARD",
  expert: "EXPERT",
};
const ENUM_TO_MODE: Record<"GUIDED" | "STANDARD" | "EXPERT", BuilderMode> = {
  GUIDED: "guided",
  STANDARD: "standard",
  EXPERT: "expert",
};

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

interface DisplayIssue {
  severity: IssueSeverity;
  message: string;
  /**
   * The slot a "Fix this" button should open a `FixDrawer` for. Only set
   * for rule-engine issues whose `subjectSlotKey` maps to one of this
   * pass's 8 core `SLOT_MODEL` entries (per `rule-engine.ts`'s `FiredIssue`
   * already carrying `subjectSlotKey`/`objectSlotKey` — `subjectSlotKey` is
   * the one this codebase's own convention picks, since every core-slot
   * rule template is phrased "subject needs X from object", e.g.
   * `CPU_MOBO_SOCKET_MATCH`'s subject is the part actually missing the
   * requirement). Connector shortfalls and the data-confidence note have no
   * single part/slot to attribute a fix to (see `part-picker.ts`'s own note
   * on why connector shortfalls aren't part-scoped) and never get a Fix
   * button — a real, flagged scope limit, not an oversight.
   */
  fixSlotKey?: string;
}

function buildDisplayIssues(report: BuildValidationReport): DisplayIssue[] {
  const ruleIssues: DisplayIssue[] = report.issues.map((issue) => ({
    severity: issue.severity.toLowerCase() as IssueSeverity,
    message: issue.message,
    fixSlotKey: findSlotDefinition(issue.subjectSlotKey) ? issue.subjectSlotKey : undefined,
  }));
  const shortfalls: DisplayIssue[] = report.connectorShortfalls.map((s) => ({
    severity: s.severity.toLowerCase() as IssueSeverity,
    message: s.message,
  }));
  const note: DisplayIssue[] = report.dataConfidenceNote
    ? [{ severity: "info", message: report.dataConfidenceNote }]
    : [];
  const order: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  return [...ruleIssues, ...shortfalls, ...note].sort(
    (a, b) => order[a.severity] - order[b.severity],
  );
}

/** §2 "a slot blocked by a missing prerequisite shows 'Pick a processor first'" — see `slots.ts`'s header comment on the single-CPU-anchor simplification this reads from. */
function slotStateFor(
  slot: BuilderSlotDefinition,
  partRows: Record<string, PartRowData>,
): BuilderSlotState {
  if (partRows[slot.slotKey]) return "filled";
  if (slot.prerequisiteSlotKey && !partRows[slot.prerequisiteSlotKey]) return "incompatible";
  return slot.required ? "empty-required" : "empty-optional";
}

/**
 * Standard mode's `StepRail` (docs §9's fuller "10-step rail" narrowed to
 * this pass's 8 core slots — flagged in PROGRESS.md, not silently
 * substituted). The first not-yet-filled *reachable* slot is "current";
 * everything before it that's filled is "complete"; everything after is
 * "upcoming" regardless of whether it happens to also be reachable, so
 * only one step ever reads as "current" at a time.
 */
function buildSteps(partRows: Record<string, PartRowData>): BuilderStepInfo[] {
  let currentAssigned = false;
  return SLOT_MODEL.map((slot) => {
    const filled = Boolean(partRows[slot.slotKey]);
    const reachable = !slot.prerequisiteSlotKey || Boolean(partRows[slot.prerequisiteSlotKey]);
    let status: BuilderStepInfo["status"];
    if (filled) {
      status = "complete";
    } else if (reachable && !currentAssigned) {
      status = "current";
      currentAssigned = true;
    } else {
      status = "upcoming";
    }
    return { label: slot.label, status, isReachable: reachable };
  });
}

export function BuilderEditView({ build, initialReport, initialPartRows }: BuilderEditViewProps) {
  const [mode, setMode] = React.useState<BuilderMode>(ENUM_TO_MODE[build.mode]);
  const [report, setReport] = React.useState<BuildValidationReport>(initialReport);
  const [partRows, setPartRows] = React.useState<Record<string, PartRowData>>(initialPartRows);

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [pickerSlotKey, setPickerSlotKey] = React.useState<string | null>(null);
  const [pickerParts, setPickerParts] = React.useState<PartRowData[]>([]);
  const [pickerLoading, setPickerLoading] = React.useState(false);

  const [fixOpen, setFixOpen] = React.useState(false);
  const [fixSlotKey, setFixSlotKey] = React.useState<string | null>(null);
  const [fixIssueMessage, setFixIssueMessage] = React.useState("");
  const [fixCandidates, setFixCandidates] = React.useState<
    Array<CandidatePartRow & { priceDeltaPaisa: number }>
  >([]);

  const [shareOpen, setShareOpen] = React.useState(false);
  const [shareUrl, setShareUrl] = React.useState("");
  const [cartStatus, setCartStatus] = React.useState<"idle" | "adding" | "done" | "error">("idle");
  const [cartMessage, setCartMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    setShareUrl(
      typeof window !== "undefined" ? `${window.location.origin}/build/${build.shortId}` : "",
    );
  }, [build.shortId]);

  async function handleModeChange(next: BuilderMode) {
    const previous = mode;
    setMode(next);
    // `next` is the closed `BuilderMode` union, not arbitrary input.
    // eslint-disable-next-line security/detect-object-injection
    const result = await setBuildModeAction({ buildId: build.id, mode: MODE_TO_ENUM[next] });
    if (!result.ok) {
      setMode(previous);
      toast.error(result.message ?? "Couldn't change the builder mode.");
    }
  }

  async function openPicker(slotKey: string) {
    setPickerSlotKey(slotKey);
    setPickerOpen(true);
    setPickerLoading(true);
    setPickerParts([]);
    const result = await listPartsForSlotAction({ buildId: build.id, slotKey });
    setPickerLoading(false);
    if (!result.ok || !result.data) {
      toast.error(result.message ?? "Couldn't load parts for this slot.");
      return;
    }
    setPickerParts(result.data);
  }

  async function handlePickerSelect(part: PartRowData) {
    if (!pickerSlotKey) return;
    const slotKey = pickerSlotKey;
    const result = await setBuildItemAction({
      buildId: build.id,
      slotKey,
      partId: part.id,
      quantity: 1,
    });
    if (!result.ok || !result.data) {
      toast.error(result.message ?? "Couldn't save this part.");
      return;
    }
    setReport(result.data);
    setPartRows((prev) => ({ ...prev, [slotKey]: part }));
    setPickerOpen(false);
    setPickerSlotKey(null);
  }

  async function handleRemove(slotKey: string) {
    const result = await removeBuildItemAction({ buildId: build.id, slotKey });
    if (!result.ok || !result.data) {
      toast.error(result.message ?? "Couldn't remove this part.");
      return;
    }
    setReport(result.data);
    setPartRows((prev) => {
      const next = { ...prev };
      // `slotKey` always comes from this file's own `SLOT_MODEL`-derived
      // callers, never arbitrary user input.
      // eslint-disable-next-line security/detect-object-injection
      delete next[slotKey];
      return next;
    });
  }

  async function openFix(slotKey: string, issueMessage: string) {
    setFixSlotKey(slotKey);
    setFixIssueMessage(issueMessage);
    setFixOpen(true);
    setFixCandidates([]);
    // `slotKey` always comes from this file's own `SLOT_MODEL`-derived callers.
    // eslint-disable-next-line security/detect-object-injection
    const currentPartId = partRows[slotKey]?.id;
    const result = await listPartsForSlotWithDeltaAction({
      buildId: build.id,
      slotKey,
      currentPartId,
    });
    if (!result.ok || !result.data) {
      toast.error(result.message ?? "Couldn't load alternative parts.");
      return;
    }
    setFixCandidates(result.data);
  }

  async function handleFixSelect(part: PartRowData) {
    if (!fixSlotKey) return;
    const slotKey = fixSlotKey;
    const result = await setBuildItemAction({
      buildId: build.id,
      slotKey,
      partId: part.id,
      quantity: 1,
    });
    if (!result.ok || !result.data) {
      toast.error(result.message ?? "Couldn't save this part.");
      return;
    }
    setReport(result.data);
    setPartRows((prev) => ({ ...prev, [slotKey]: part }));
    setFixOpen(false);
    setFixSlotKey(null);
  }

  async function handleAddToCart() {
    setCartStatus("adding");
    const result = await addBuildToCartAction({ buildId: build.id });
    if (!result.ok || !result.data) {
      setCartStatus("error");
      setCartMessage(result.message ?? "Couldn't add this build to your cart.");
      return;
    }
    setCartStatus("done");
    setCartMessage(
      result.data.skippedPartNames.length > 0
        ? `Added ${result.data.addedCount} part(s). You'll need to source separately: ${result.data.skippedPartNames.join(", ")}.`
        : `Added ${result.data.addedCount} part(s) to your cart.`,
    );
  }

  const displayIssues = buildDisplayIssues(report);
  const requiredSlotsFilled = SLOT_MODEL.filter((slot) => slot.required).every((slot) =>
    Boolean(partRows[slot.slotKey]),
  );
  const isComplete = requiredSlotsFilled && report.errorCount === 0;
  const incompleteReason = !isComplete
    ? !requiredSlotsFilled
      ? "Fill in every required slot to continue."
      : "Fix the errors above before adding this build to cart."
    : undefined;

  const steps = buildSteps(partRows);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h1 className="text-headline-md text-on-surface">{build.name ?? "Your PC build"}</h1>
          <p className="text-body-sm text-on-surface-variant">
            {humanize(build.useCase)} · {build.targetResolution} target
          </p>
        </div>
        <ModeSelect
          value={mode}
          onChange={(next) => void handleModeChange(next)}
          className="lg:w-[360px]"
        />
      </div>

      <div
        className={cn(
          "grid gap-6",
          mode === "standard" ? "lg:grid-cols-[200px_1fr_320px]" : "lg:grid-cols-[1fr_320px]",
        )}
      >
        {mode === "standard" && (
          <StepRail
            steps={steps}
            onStepClick={(index) => {
              // `index` is a numeric array index from `StepRail`'s own map over `steps`, never arbitrary input.
              // eslint-disable-next-line security/detect-object-injection
              const slot = SLOT_MODEL[index];
              if (slot) void openPicker(slot.slotKey);
            }}
          />
        )}

        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {SLOT_MODEL.map((slot) => {
              const part = partRows[slot.slotKey];
              const state = slotStateFor(slot, partRows);
              return (
                <BuilderSlotCard
                  key={slot.slotKey}
                  slotLabel={slot.label}
                  state={state}
                  part={part}
                  prerequisiteLabel={state === "incompatible" ? "processor" : undefined}
                  onPick={() => void openPicker(slot.slotKey)}
                  onRemove={part ? () => void handleRemove(slot.slotKey) : undefined}
                />
              );
            })}
          </div>

          <Card variant="glass">
            <CardHeader>
              <span className="text-title text-on-surface">Compatibility</span>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <CompatibilityPanel
                compatibilityScore={report.compatibilityScore}
                issueCount={{
                  error: report.errorCount,
                  warning: report.warningCount,
                  info: report.infoCount,
                }}
                powerMeterProps={{
                  typicalDrawWatts: report.power.baseLoadWatts,
                  peakDrawWatts: report.power.peakLoadWatts,
                  recommendedPsuWatts: report.power.recommendedPsuWatts,
                  selectedPsuWatts: report.power.selectedPsuWatts ?? undefined,
                }}
                balanceMeterProps={
                  report.balance.cpuScore > 0 && report.balance.gpuScore > 0
                    ? { score: report.balance.adjustedBalance }
                    : undefined
                }
              />

              {displayIssues.length > 0 && (
                <div className="flex flex-col gap-2">
                  {displayIssues.map((issue, index) => (
                    <IssueRow
                      key={index}
                      severity={issue.severity}
                      message={issue.message}
                      onFix={
                        issue.fixSlotKey
                          ? () => void openFix(issue.fixSlotKey as string, issue.message)
                          : undefined
                      }
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4">
          <BuildSummaryPanel
            totalPrice={report.totalPaisa}
            isComplete={isComplete}
            incompleteReason={incompleteReason}
            onShare={() => setShareOpen(true)}
            onPrintPdf={() => window.print()}
            onAddToCart={() => void handleAddToCart()}
          />
          {cartStatus !== "idle" && cartMessage && (
            <p
              role="status"
              className={
                cartStatus === "error"
                  ? "text-body-sm text-danger"
                  : "text-body-sm text-on-surface-variant"
              }
            >
              {cartMessage}
            </p>
          )}
        </div>
      </div>

      <PartPickerDrawer
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        slotLabel={pickerSlotKey ? slotLabel(pickerSlotKey) : ""}
        parts={pickerLoading ? [] : pickerParts}
        onSelect={(part) => void handlePickerSelect(part)}
      />

      <FixDrawer
        open={fixOpen}
        onOpenChange={setFixOpen}
        issueMessage={fixIssueMessage}
        candidates={fixCandidates}
        onSelectCandidate={(part) => void handleFixSelect(part)}
      />

      <BuildShareDialog open={shareOpen} onOpenChange={setShareOpen} shareUrl={shareUrl} />
    </div>
  );
}
