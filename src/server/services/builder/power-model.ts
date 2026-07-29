/**
 * Power model — docs/08-PC-BUILDER-ENGINE.md §5, deliberately not the
 * reference app's `CPU TDP + GPU max draw + 100W` shortcut. Every
 * constant below is transcribed from §5.1's consumption table and §5.2's
 * transient-headroom formula — nothing here is invented.
 */
import "server-only";
import type { SelectedPart } from "./build-context";

function motherboardBaseWatts(formFactor: unknown): number {
  switch (formFactor) {
    case "MICRO_ATX":
      return 25;
    case "MINI_ITX":
      return 20;
    case "ATX":
    case "E_ATX":
    default:
      return 30;
  }
}

const RAM_WATTS_PER_STICK: Record<"DDR4" | "DDR5", number> = { DDR4: 3, DDR5: 5 };

const STANDARD_PSU_WATTAGES = [450, 550, 650, 750, 850, 1000, 1200, 1600];

export interface PowerReport {
  baseLoadWatts: number;
  peakLoadWatts: number;
  recommendedPsuWatts: number;
  selectedPsuWatts: number | null;
  loadPercent: number | null;
  verdict: "OVERSIZED" | "UNDERSIZED" | "TIGHT" | "GOOD" | "NO_PSU_SELECTED";
}

function specNumber(specs: unknown, key: string): number | undefined {
  if (typeof specs !== "object" || specs === null) return undefined;
  // eslint-disable-next-line security/detect-object-injection -- `key` is always a literal spec field name passed by this file's own callers, never user input.
  const value = (specs as Record<string, unknown>)[key];
  return typeof value === "number" ? value : undefined;
}

/** `roundUpToStandard` — docs §5.3: "450,550,650,750,850,1000,1200,1600". Anything above the largest standard step still rounds to a real number rather than silently capping. */
export function roundUpToStandardPsuWattage(watts: number): number {
  const match = STANDARD_PSU_WATTAGES.find((step) => step >= watts);
  if (match) return match;
  // Above the table's top step — round up to the next 200W, matching the
  // spacing of the table's own top end (1000 -> 1200 -> 1600).
  return Math.ceil(watts / 200) * 200;
}

/** CPU contribution — §5.1: `maxTurboPowerWatts`, falling back to `tdpWatts × 1.35` (Intel) / `× 1.30` (AMD) when unknown. */
function cpuContributionWatts(cpu: SelectedPart | undefined): number {
  if (!cpu) return 0;
  const maxTurbo = specNumber(cpu.part.specs, "maxTurboPowerWatts");
  if (maxTurbo) return maxTurbo;
  const tdp = cpu.part.tdpWatts ?? specNumber(cpu.part.specs, "tdpWatts") ?? 0;
  const brand =
    typeof cpu.part.specs === "object" && cpu.part.specs !== null
      ? (cpu.part.specs as Record<string, unknown>).brand
      : undefined;
  const multiplier = brand === "INTEL" ? 1.35 : 1.3;
  return tdp * multiplier;
}

function gpuTdpWatts(gpu: SelectedPart | undefined): number {
  if (!gpu) return 0;
  return gpu.part.tdpWatts ?? specNumber(gpu.part.specs, "tdpWatts") ?? 0;
}

/** §5.2: `transientPeak = GPU.transientPeakWatts ?? GPU.tdpWatts × (GPU.transientMultiplier ?? 1.8)`. */
function gpuTransientPeakWatts(gpu: SelectedPart | undefined): number {
  if (!gpu) return 0;
  const explicit = specNumber(gpu.part.specs, "transientPeakWatts");
  if (explicit) return explicit;
  const tdp = gpuTdpWatts(gpu);
  const multiplier =
    gpu.part.transientMultiplier ?? specNumber(gpu.part.specs, "transientMultiplier") ?? 1.8;
  return tdp * multiplier;
}

function findBySlotPrefix(parts: SelectedPart[], prefix: string): SelectedPart[] {
  return parts.filter((p) => p.slotKey === prefix || p.slotKey.startsWith(`${prefix}_`));
}

/**
 * Runs the full §5 model over a build's selected parts. `selectedPsuWatts`
 * is read straight off the PSU part's own specs, not from a separate
 * argument, so this function has one source of truth for "what PSU (if
 * any) is currently in the build."
 */
export function computePowerReport(parts: SelectedPart[]): PowerReport {
  const cpu = parts.find((p) => p.slotKey === "cpu");
  const gpu = parts.find((p) => p.slotKey === "gpu");
  const motherboard = parts.find((p) => p.slotKey === "motherboard");
  const ramSticks = findBySlotPrefix(parts, "ram");
  const storageDrives = findBySlotPrefix(parts, "storage");
  const caseFans = findBySlotPrefix(parts, "case_fan");
  const cooler = parts.find((p) => p.slotKey === "cpu_cooler");
  const expansionCards = findBySlotPrefix(parts, "expansion");
  const psu = parts.find((p) => p.slotKey === "psu");

  let baseLoadWatts = 0;
  baseLoadWatts += cpuContributionWatts(cpu);
  baseLoadWatts += gpuTdpWatts(gpu);

  if (motherboard) {
    const formFactor = (motherboard.part.specs as Record<string, unknown> | null)?.formFactor;
    baseLoadWatts += motherboardBaseWatts(formFactor);
  }

  for (const ram of ramSticks) {
    const type = (ram.part.specs as Record<string, unknown> | null)?.type as
      | "DDR4"
      | "DDR5"
      | undefined;
    // eslint-disable-next-line security/detect-object-injection -- `type` is narrowed to the two-value `"DDR4" | "DDR5"` union, never arbitrary input.
    const perStick = type ? RAM_WATTS_PER_STICK[type] : 4;
    const stickCount = specNumber(ram.part.specs, "stickCount") ?? ram.quantity;
    baseLoadWatts += perStick * stickCount;
  }

  for (const drive of storageDrives) {
    const iface = (drive.part.specs as Record<string, unknown> | null)?.interface as
      | string
      | undefined;
    const formFactor = (drive.part.specs as Record<string, unknown> | null)?.formFactor as
      | string
      | undefined;
    if (iface?.startsWith("NVME")) baseLoadWatts += 7 * drive.quantity;
    else if (formFactor === "SATA_3_5") baseLoadWatts += 10 * drive.quantity;
    else baseLoadWatts += 3 * drive.quantity; // SATA SSD
  }

  baseLoadWatts += caseFans.reduce((sum, fan) => sum + 3 * fan.quantity, 0);
  if (cooler && (cooler.part.specs as Record<string, unknown> | null)?.type === "AIO_LIQUID") {
    baseLoadWatts += 10;
  }
  baseLoadWatts += expansionCards.reduce((sum, card) => sum + 15 * card.quantity, 0);
  // RGB / peripherals — flat 15W whenever the build has at least one part
  // (docs §5.1 lists this as a flat line item, not per-device).
  if (parts.length > 0) baseLoadWatts += 15;

  baseLoadWatts = Math.round(baseLoadWatts);

  const gpuTdp = gpuTdpWatts(gpu);
  const transientPeak = gpuTransientPeakWatts(gpu);
  const peakLoadWatts = Math.round(baseLoadWatts - gpuTdp + transientPeak);

  const efficiencyTarget = 0.6;
  const recommendedWatts = Math.max(baseLoadWatts / efficiencyTarget, peakLoadWatts * 1.1);
  const recommendedPsuWatts = roundUpToStandardPsuWattage(recommendedWatts);

  const selectedPsuWatts = psu ? (specNumber(psu.part.specs, "wattage") ?? null) : null;
  const loadPercent = selectedPsuWatts
    ? Math.round((baseLoadWatts / selectedPsuWatts) * 100)
    : null;

  let verdict: PowerReport["verdict"] = "NO_PSU_SELECTED";
  if (selectedPsuWatts !== null) {
    if (selectedPsuWatts < peakLoadWatts) verdict = "UNDERSIZED";
    else if (selectedPsuWatts < recommendedPsuWatts) verdict = "TIGHT";
    else if (selectedPsuWatts > recommendedPsuWatts * 2) verdict = "OVERSIZED";
    else verdict = "GOOD";
  }

  return {
    baseLoadWatts,
    peakLoadWatts,
    recommendedPsuWatts,
    selectedPsuWatts,
    loadPercent,
    verdict,
  };
}
