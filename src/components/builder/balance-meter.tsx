import { CheckCircle2, AlertCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BalanceMeter — docs/08-PC-BUILDER-ENGINE.md §6 "Balance / bottleneck
 * model": "Rendered as a balance meter — a horizontal gauge with CPU at one
 * end and GPU at the other and a marker showing where this build sits, plus
 * one sentence."
 *
 * This component does NOT compute the balance score itself — `score` (the
 * doc's `adjusted` value) arrives pre-computed from upstream, ranging
 * roughly -100 (CPU-limited) to +100 (GPU-limited). It only renders it,
 * per the doc's verdict table on `|adjusted|`:
 *
 *   |adjusted| <= 12   -> "Well matched"       success, no issue
 *   |adjusted| 13-25   -> "Slight imbalance"   info
 *   |adjusted| 26-40   -> "Noticeable"         warning (+ suggested change)
 *   |adjusted| > 40    -> "Significant"        warning (+ specific alt & price delta)
 *
 * The last two rows both render as a warning-tone verdict; the doc
 * distinguishes them only by the *content* of the accompanying sentence
 * ("suggested part change" vs "a specific alternative with the price
 * delta"), not by a different colour/icon — so both are folded into one
 * `warning` tone here, and the caller decides how specific `suggestion`
 * gets for either band.
 *
 * The marker's position is `((clampedScore + 100) / 200) * 100`% along the
 * track, with `score` defensively clamped to [-100, 100] first in case an
 * upstream computation ever drifts outside the documented range. Per
 * docs/05-DESIGN-SYSTEM.md §5 A6 ("never colour alone"), the verdict is
 * always paired with a distinct icon, not colour alone.
 *
 * No `"use client"` — purely presentational, no event handlers.
 */
export interface BalanceMeterProps {
  /** Pre-computed balance score (the doc's `adjusted` value), roughly -100 (CPU-limited) to +100 (GPU-limited). */
  score: number;
  /** Optional pre-written plain-language suggestion sentence, e.g. "Your processor will hold back this graphics card at 1080p. Moving to a Ryzen 7 7700 (+रु 12,400) would unlock roughly 15-20% more frames." */
  suggestion?: string;
  className?: string;
}

type BalanceTone = "success" | "info" | "warning";

interface BalanceVerdict {
  tone: BalanceTone;
  label: string;
}

/**
 * Maps `|adjusted|` to a tone + label per the verdict table documented
 * above.
 */
function verdictForMagnitude(magnitude: number): BalanceVerdict {
  if (magnitude > 40) {
    return { tone: "warning", label: "Significant imbalance" };
  }
  if (magnitude > 25) {
    return { tone: "warning", label: "Noticeable imbalance" };
  }
  if (magnitude > 12) {
    return { tone: "info", label: "Slight imbalance" };
  }
  return { tone: "success", label: "Well matched" };
}

const TONE_TEXT_CLASS: Record<BalanceTone, string> = {
  success: "text-success",
  info: "text-info",
  warning: "text-warning",
};

const TONE_MARKER_CLASS: Record<BalanceTone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
};

const TONE_ICON: Record<BalanceTone, typeof CheckCircle2> = {
  success: CheckCircle2,
  info: AlertCircle,
  warning: AlertTriangle,
};

export function BalanceMeter({ score, suggestion, className }: BalanceMeterProps) {
  const clampedScore = Math.min(100, Math.max(-100, score));
  const markerPercent = ((clampedScore + 100) / 200) * 100;
  const verdict = verdictForMagnitude(Math.abs(clampedScore));
  const Icon = TONE_ICON[verdict.tone];

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between text-label-mono-xs text-on-surface-variant">
        <span>CPU</span>
        <span>GPU</span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-surface-container-high">
        <span
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 h-3 w-px -translate-x-1/2 -translate-y-1/2 bg-glass-stroke"
        />
        <div
          role="progressbar"
          aria-valuenow={Math.round(clampedScore)}
          aria-valuemin={-100}
          aria-valuemax={100}
          aria-label="CPU/GPU balance"
          className={cn(
            "absolute top-1/2 size-3.5 -translate-y-1/2 -translate-x-1/2 rounded-full ring-2 ring-offset-2 ring-offset-background",
            TONE_MARKER_CLASS[verdict.tone],
          )}
          style={{ left: `${markerPercent}%` }}
        />
      </div>
      <div className={cn("flex items-center gap-2 text-body-sm", TONE_TEXT_CLASS[verdict.tone])}>
        <Icon className="size-4 shrink-0" aria-hidden="true" />
        <span>{verdict.label}</span>
      </div>
      {suggestion && <p className="text-body-sm text-on-surface-variant">{suggestion}</p>}
    </div>
  );
}
