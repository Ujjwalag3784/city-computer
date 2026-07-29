"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CompatibilityPanel } from "@/components/builder/compatibility-panel";
import { IssueRow } from "@/components/builder/issue-row";
import { BuildSummaryPanel } from "@/components/builder/build-summary-panel";
import { BuildShareDialog } from "@/components/builder/build-share-dialog";
import { formatNPR } from "@/lib/money";
import type { getBuildByShortId } from "@/server/services/builder/builds";
import type { BuildValidationReport } from "@/server/services/builder/validate-build";
import { addBuildToCartAction } from "../../_actions";

type BuildWithItems = Awaited<ReturnType<typeof getBuildByShortId>>;

export interface BuildShareViewProps {
  build: BuildWithItems;
  report: BuildValidationReport;
}

function humanizePartType(partType: string): string {
  return partType
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

/** All the messages a shopper cares about, worst severity first — matches `CompatibilityPanel`'s own severity ordering. */
function allIssueMessages(
  report: BuildValidationReport,
): Array<{ severity: "error" | "warning" | "info"; message: string }> {
  const ruleIssues = report.issues.map((issue) => ({
    severity: issue.severity.toLowerCase() as "error" | "warning" | "info",
    message: issue.message,
  }));
  const shortfalls = report.connectorShortfalls.map((s) => ({
    severity: s.severity.toLowerCase() as "error" | "info",
    message: s.message,
  }));
  const note = report.dataConfidenceNote
    ? [{ severity: "info" as const, message: report.dataConfidenceNote }]
    : [];
  const order = { error: 0, warning: 1, info: 2 };
  return [...ruleIssues, ...shortfalls, ...note].sort(
    (a, b) => order[a.severity] - order[b.severity],
  );
}

export function BuildShareView({ build, report }: BuildShareViewProps) {
  const router = useRouter();
  const [shareOpen, setShareOpen] = React.useState(false);
  const [cartStatus, setCartStatus] = React.useState<"idle" | "adding" | "done" | "error">("idle");
  const [cartMessage, setCartMessage] = React.useState<string | null>(null);

  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const messages = allIssueMessages(report);
  const isComplete = report.errorCount === 0 && build.items.length > 0;

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
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-headline-md text-on-surface">{build.name ?? "Shared PC build"}</h1>
          <p className="text-body-sm text-on-surface-variant">
            {humanizePartType(build.useCase)} · {build.targetResolution} · Mode:{" "}
            {build.mode.toLowerCase()}
          </p>
        </div>

        <Card variant="glass">
          <CardHeader>
            <span className="text-title text-on-surface">Parts in this build</span>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {build.items.length === 0 && (
              <p className="text-body-sm text-on-surface-variant">
                This build doesn&apos;t have any parts yet.
              </p>
            )}
            {build.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-glass-stroke bg-surface-container p-3"
              >
                <div className="flex flex-col">
                  <span className="text-label-mono-xs text-on-surface-variant">
                    {humanizePartType(item.part.partType)}
                  </span>
                  <span className="text-body-md text-on-surface">
                    {item.part.manufacturer} {item.part.model}
                    {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                  </span>
                </div>
                <span className="text-body-md font-medium tabular-nums text-on-surface">
                  {formatNPR(item.unitPricePaisaSnapshot * item.quantity)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

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

            {messages.length > 0 && (
              <div className="flex flex-col gap-2">
                {messages.map((issue, index) => (
                  <IssueRow key={index} severity={issue.severity} message={issue.message} />
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
          incompleteReason={
            !isComplete
              ? report.errorCount > 0
                ? "Fix the errors above before adding this build to cart."
                : "This build has no parts yet."
              : undefined
          }
          autosaveStatus={undefined}
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

      <BuildShareDialog open={shareOpen} onOpenChange={setShareOpen} shareUrl={shareUrl} />
    </div>
  );
}
