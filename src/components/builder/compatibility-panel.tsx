import type * as React from "react";
import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { PowerMeter } from "@/components/builder/power-meter";
import { BalanceMeter } from "@/components/builder/balance-meter";
import { cn } from "@/lib/utils";

/**
 * CompatibilityPanel — docs/08-PC-BUILDER-ENGINE.md §9 "Issue presentation",
 * surface 2: "Summary panel — compatibility score, power meter, balance
 * meter, issue count." This is the compact, always-visible compatibility
 * summary strip, not the full build price/checkout summary (a separate,
 * larger `BuildSummaryPanel` is being built elsewhere) — this component has
 * no pricing/checkout dependency and stays self-contained.
 *
 * `compatibilityScore` is assumed to be 0-100 (undocumented elsewhere in the
 * engine spec at the exact-numeric level, so this component pins the range
 * itself) and is shown with a qualitative label, never colour alone (docs/05
 * -DESIGN-SYSTEM.md §5 A6):
 *
 *   score >= 80        -> "Looks good"              success
 *   50 <= score < 80    -> "A few things to check"   warning
 *   score < 50          -> "Needs attention"         danger
 *
 * Issue counts reuse the exact icon mapping `issue-row.tsx` establishes
 * (AlertCircle/error, AlertTriangle/warning, Info/info) so the same
 * severity always reads with the same icon everywhere in the builder.
 * Any severity with a zero count is omitted rather than shown as "0
 * errors" clutter.
 *
 * `powerMeterProps`/`balanceMeterProps` are both optional — a panel can be
 * rendered before enough parts are picked to compute either meter (e.g.
 * before a PSU or a CPU+GPU pair exists), in which case that meter section
 * is simply omitted.
 *
 * No `"use client"` at this panel's own level — it only composes
 * `PowerMeter` and `BalanceMeter`, neither of which are Client Components
 * either, and this file attaches no event handlers of its own.
 */
export interface CompatibilityPanelProps {
  /** Overall compatibility score, 0-100. */
  compatibilityScore: number;
  issueCount: {
    error: number;
    warning: number;
    info: number;
  };
  powerMeterProps?: React.ComponentProps<typeof PowerMeter>;
  balanceMeterProps?: React.ComponentProps<typeof BalanceMeter>;
  className?: string;
}

type ScoreTone = "success" | "warning" | "danger";

interface ScoreVerdict {
  tone: ScoreTone;
  label: string;
}

function verdictForScore(score: number): ScoreVerdict {
  if (score >= 80) {
    return { tone: "success", label: "Looks good" };
  }
  if (score >= 50) {
    return { tone: "warning", label: "A few things to check" };
  }
  return { tone: "danger", label: "Needs attention" };
}

const SCORE_TEXT_CLASS: Record<ScoreTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

type IssueSeverityKey = "error" | "warning" | "info";

const SEVERITY_ICON: Record<IssueSeverityKey, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_TEXT_CLASS: Record<IssueSeverityKey, string> = {
  error: "text-danger",
  warning: "text-warning",
  info: "text-info",
};

const SEVERITY_ORDER: IssueSeverityKey[] = ["error", "warning", "info"];

export function CompatibilityPanel({
  compatibilityScore,
  issueCount,
  powerMeterProps,
  balanceMeterProps,
  className,
}: CompatibilityPanelProps) {
  const verdict = verdictForScore(compatibilityScore);

  return (
    <div className={cn("flex flex-col gap-5", className)}>
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-label-mono-xs text-on-surface-variant">Compatibility</span>
          <span className="text-title text-on-surface">{Math.round(compatibilityScore)}</span>
        </div>
        <span className={cn("text-body-sm font-medium", SCORE_TEXT_CLASS[verdict.tone])}>
          {verdict.label}
        </span>
      </div>

      <div className="flex flex-wrap gap-4">
        {SEVERITY_ORDER.map((severity) => {
          // `severity` is always one of `SEVERITY_ORDER`'s own closed-union
          // values (this is the array being mapped over), never arbitrary
          // input — safe to index `issueCount`/`SEVERITY_ICON`/`SEVERITY_TEXT_CLASS` with it.
          // eslint-disable-next-line security/detect-object-injection
          const count = issueCount[severity];
          if (count === 0) return null;
          // eslint-disable-next-line security/detect-object-injection
          const Icon = SEVERITY_ICON[severity];
          return (
            <span
              key={severity}
              className={cn(
                "flex items-center gap-1.5 text-body-sm",
                // eslint-disable-next-line security/detect-object-injection
                SEVERITY_TEXT_CLASS[severity],
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {count} {severity}
              {count === 1 ? "" : "s"}
            </span>
          );
        })}
      </div>

      {powerMeterProps && <PowerMeter {...powerMeterProps} />}
      {balanceMeterProps && <BalanceMeter {...balanceMeterProps} />}
    </div>
  );
}
