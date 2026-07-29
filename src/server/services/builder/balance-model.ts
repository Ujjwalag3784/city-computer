/**
 * Balance / bottleneck meter — docs/08-PC-BUILDER-ENGINE.md §6. Compares a
 * normalized CPU score against a normalized GPU score, weighted by how
 * much the target resolution actually leans on the CPU.
 *
 * Docs §6's own formula is `gpuScore = gpu.benchmarkAtResolution(...)` —
 * i.e. the *GPU score itself* is meant to already vary by resolution
 * (from real per-resolution benchmark data), with the `weight` multiplier
 * on top of that. This pass's `GpuSpec` does carry `benchmark1080p` /
 * `benchmark1440p` / `benchmark2160p` fields for that purpose, but no
 * seeded part populates them yet (real per-resolution benchmark data
 * sourcing is out of scope for this pass — see PROGRESS.md), so
 * `normalizedScore` below falls back to the same flat, resolution-
 * independent `performanceTier` figure for both CPU and GPU. The `weight`
 * multiplier alone is still applied faithfully to whatever `gpuScore` and
 * `cpuScore` resolve to.
 *
 * One consequence worth flagging so it doesn't read as a bug: because
 * `adjusted = balance × (1 − weight)` and `weight` is *largest* at FHD
 * (0.55) and *smallest* at UHD (0.25), a fixed CPU/GPU score gap produces
 * a LARGER `|adjusted|` at UHD than at FHD — i.e. with flat, non-
 * resolution-aware scores, this model reads a big score gap as more
 * severe at 4K, not less. That looks backwards next to docs §6's own
 * flavor-text example ("your processor will hold back this GPU at
 * 1080p"), but that example implicitly assumes a *lower* resolution-
 * specific `gpuScore` at 1080p for that specific GPU/game pairing — a
 * real per-resolution benchmark input this pass doesn't have. The formula
 * itself is transcribed exactly as written in docs §6; only the score
 * inputs are the simplified part.
 */
import "server-only";
import type { SelectedPart } from "./build-context";

export type BuildResolution = "FHD" | "QHD" | "UHD" | "ULTRAWIDE";

/**
 * §6.1 — "CPU weight" per target resolution: how much a CPU/GPU mismatch
 * actually shows up in real-world FPS at that resolution. Docs §6.1 only
 * tables FHD/QHD/UHD; `Build.targetResolution` also allows `ULTRAWIDE`
 * (typically 3440x1440, a QHD-class pixel count rendered wider), so it
 * borrows QHD's weight rather than leaving a fourth enum value
 * unhandled — this codebase's own reasonable extrapolation, not a docs
 * figure.
 */
const CPU_WEIGHT_BY_RESOLUTION: Record<BuildResolution, number> = {
  FHD: 0.55,
  QHD: 0.4,
  UHD: 0.25,
  ULTRAWIDE: 0.4,
};

export type BalanceVerdict =
  | "BALANCED"
  | "CPU_BOTTLENECK_MODERATE"
  | "GPU_BOTTLENECK_MODERATE"
  | "CPU_BOTTLENECK_SEVERE"
  | "GPU_BOTTLENECK_SEVERE";

export interface BalanceReport {
  cpuScore: number;
  gpuScore: number;
  rawBalance: number;
  adjustedBalance: number;
  verdict: BalanceVerdict;
}

function normalizedScore(part: SelectedPart | undefined): number {
  if (!part) return 0;
  if (typeof part.part.benchmarkScore === "number") {
    return Math.max(0, Math.min(100, part.part.benchmarkScore));
  }
  if (typeof part.part.performanceTier === "number") {
    // `performanceTier` is documented (§3.1) as a coarse 1-10 scale used
    // when no real benchmark figure has been sourced yet — scale it onto
    // the same 0-100 range a benchmark score would occupy.
    return Math.max(0, Math.min(100, part.part.performanceTier * 10));
  }
  return 0;
}

/** §6.2 — verdict bands on the resolution-adjusted balance figure: |adjusted| <= 12 balanced, 13-25 moderate, 26-40 / >40 severe, direction from the raw (unweighted) balance's sign. */
function verdictFor(adjustedBalance: number, rawBalance: number): BalanceVerdict {
  const magnitude = Math.abs(adjustedBalance);
  if (magnitude <= 12) return "BALANCED";
  const leaningGpu = rawBalance > 0; // gpuScore > cpuScore -> GPU has headroom the CPU can't feed -> CPU is the bottleneck
  if (magnitude <= 40) {
    return leaningGpu ? "CPU_BOTTLENECK_MODERATE" : "GPU_BOTTLENECK_MODERATE";
  }
  return leaningGpu ? "CPU_BOTTLENECK_SEVERE" : "GPU_BOTTLENECK_SEVERE";
}

/** Runs the §6 model for a build's CPU/GPU pair at a given target resolution. Returns a neutral `BALANCED` report (both scores 0) when either part is missing, since an incomplete build has nothing to judge yet — callers should gate display on `build.hasCpu && build.hasGpu`. */
export function computeBalanceReport(
  parts: SelectedPart[],
  resolution: BuildResolution,
): BalanceReport {
  const cpu = parts.find((p) => p.slotKey === "cpu");
  const gpu = parts.find((p) => p.slotKey === "gpu");

  const cpuScore = normalizedScore(cpu);
  const gpuScore = normalizedScore(gpu);

  if (!cpu || !gpu) {
    return { cpuScore, gpuScore, rawBalance: 0, adjustedBalance: 0, verdict: "BALANCED" };
  }

  const rawBalance = gpuScore - cpuScore;
  // eslint-disable-next-line security/detect-object-injection -- `resolution` is typed `BuildResolution`, a closed 4-value union, never arbitrary input.
  const cpuWeight = CPU_WEIGHT_BY_RESOLUTION[resolution];
  const adjustedBalance = rawBalance * (1 - cpuWeight);

  return {
    cpuScore,
    gpuScore,
    rawBalance,
    adjustedBalance,
    verdict: verdictFor(adjustedBalance, rawBalance),
  };
}
