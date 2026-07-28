import { cn } from "@/lib/utils";

/**
 * PowerMeter — docs/08-PC-BUILDER-ENGINE.md §5.5 "Display":
 *
 *   "The summary panel shows: estimated typical draw (baseLoad), peak draw,
 *   recommended PSU, and the selected PSU with a load bar — green 40–70%,
 *   amber 70–85%, red > 85% or below 20%."
 *
 * §5.5 only pins down four bands explicitly: green [40,70], amber [70,85],
 * red (85,100] and red [0,20). That leaves (20,40) undefined. This component
 * reads it as "fine, just not optimally efficient" and folds it into the
 * green band, i.e. treats the effective bands as:
 *
 *   loadPercent < 20            -> red    ("Oversized")
 *   20 <= loadPercent <= 70     -> green  ("Comfortable headroom")
 *   70 < loadPercent <= 85      -> amber  ("Running hot")
 *   loadPercent > 85            -> red    ("Undersized")
 *
 * Rationale: §5.4's own rule table only ever fires a warning/info at the
 * *recommended* wattage threshold, not at 40%; a PSU loaded at 25-40% is
 * still comfortably within spec and arguably safer than one at 65%, so
 * lumping it in with "red" would over-warn. The load bar's colour is always
 * paired with a text verdict per A6 ("never colour alone"), so the exact
 * boundary choice here is a presentation nuance, not a safety-critical one
 * — a later phase can retune these two numbers without changing the prop
 * contract.
 *
 * Note on labels: the four example labels in the brief ("Comfortable
 * headroom" / "Running hot" / "Undersized" / "Oversized") map one-to-one
 * onto the four zones above — "Undersized" for the >85% red band (the PSU
 * is too small for how hard it's being pushed, echoing §5.4's
 * `psu.wattage < recommendedWatts` rule), and "Oversized" for the <20% red
 * band (echoing §5.4's `psu.wattage > recommendedWatts × 2` rule — a PSU
 * far bigger than this build needs). "Running hot" is reserved for the
 * amber 70–85% band, short of actually being undersized.
 *
 * Wattage is always rendered as an integer followed by " W" (docs/05
 * §9 numbers rule: "Wattage as `750 W`").
 */
export interface PowerMeterProps {
  /** Estimated typical (base) draw in watts. */
  typicalDrawWatts: number;
  /** Estimated peak draw in watts. */
  peakDrawWatts: number;
  /** Recommended PSU wattage per §5.3's `recommendedWatts` formula. */
  recommendedPsuWatts: number;
  /** Wattage of the PSU currently selected in the build, if any. */
  selectedPsuWatts?: number;
  className?: string;
}

type LoadTone = "success" | "warning" | "danger";

interface LoadVerdict {
  tone: LoadTone;
  label: string;
}

/**
 * Maps a load percentage (typicalDrawWatts / selectedPsuWatts * 100) to a
 * tone + label per the threshold reading documented above.
 */
function verdictForLoadPercent(loadPercent: number): LoadVerdict {
  if (loadPercent > 85) {
    return { tone: "danger", label: "Undersized" };
  }
  if (loadPercent > 70) {
    return { tone: "warning", label: "Running hot" };
  }
  if (loadPercent >= 20) {
    return { tone: "success", label: "Comfortable headroom" };
  }
  return { tone: "danger", label: "Oversized" };
}

const TONE_BAR_CLASS: Record<LoadTone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

const TONE_TEXT_CLASS: Record<LoadTone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

function formatWatts(watts: number): string {
  return `${Math.round(watts)} W`;
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-label-mono-xs text-on-surface-variant">{label}</span>
      <span className="text-body-md text-on-surface">{formatWatts(value)}</span>
    </div>
  );
}

export function PowerMeter({
  typicalDrawWatts,
  peakDrawWatts,
  recommendedPsuWatts,
  selectedPsuWatts,
  className,
}: PowerMeterProps) {
  const hasSelectedPsu = typeof selectedPsuWatts === "number" && selectedPsuWatts > 0;
  const loadPercent = hasSelectedPsu
    ? Math.min(100, Math.max(0, (typicalDrawWatts / selectedPsuWatts) * 100))
    : 0;
  const verdict = hasSelectedPsu ? verdictForLoadPercent(loadPercent) : null;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="grid grid-cols-3 gap-4">
        <StatItem label="Typical draw" value={typicalDrawWatts} />
        <StatItem label="Peak draw" value={peakDrawWatts} />
        <StatItem label="Recommended PSU" value={recommendedPsuWatts} />
      </div>

      {hasSelectedPsu && verdict ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-label-mono-xs text-on-surface-variant">
            <span>Selected PSU: {formatWatts(selectedPsuWatts)}</span>
            <span>{Math.round(loadPercent)}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(loadPercent)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high"
          >
            <div
              className={cn("h-full rounded-full transition-colors", TONE_BAR_CLASS[verdict.tone])}
              style={{ width: `${loadPercent}%` }}
            />
          </div>
          <span className={cn("text-body-sm", TONE_TEXT_CLASS[verdict.tone])}>{verdict.label}</span>
        </div>
      ) : (
        <p className="text-body-sm text-on-surface-variant">
          Pick a power supply to see how it handles this build.
        </p>
      )}
    </div>
  );
}
