/**
 * Golden-build tests for the PC Builder rule engine — docs/08-PC-BUILDER-ENGINE.md
 * §12's "known-good/known-bad fixture builds asserted every commit"
 * requirement, scoped down to ~13 fixtures rather than the docs' full
 * ~40 (flagged in PROGRESS.md), but including the one docs calls out by
 * name: an mATX board + a 420mm AIO + a flagship GPU in a Mini-ITX case
 * must produce at least 3 ERROR-severity issues.
 *
 * These tests run the whole non-DB half of the engine — power model,
 * connector satisfaction, balance model, aggregate computation, and rule
 * evaluation — against hand-built `SelectedPart[]` fixtures. They
 * deliberately do NOT touch `validate-build.ts`'s `loadSelectedParts`/
 * `validateBuild` (those need a live `Build` row and the DB-backed rule
 * cache); `runValidation` below reimplements just the pure orchestration
 * steps from `validate-build.ts` so the whole pipeline can be exercised
 * without a database, using `rule-catalogue.ts`'s `toRuleRecords()` as
 * the same rule set the real seed writes to `CompatibilityRule`.
 */
import { describe, expect, it } from "vitest";
import type { PartType, ConnectorDirection, ConnectorType } from "@/generated/prisma/client";
import { computePowerReport } from "./power-model";
import { computeConnectorBalance } from "./connector-check";
import { computeBalanceReport, type BuildResolution } from "./balance-model";
import { buildAggregates, type SelectedPart, type BuildSettings } from "./build-context";
import { evaluateRules } from "./rule-engine";
import { toRuleRecords } from "./rule-catalogue";
import { buildConnectorShortfallIssues } from "./validate-build";

let nextId = 1;

interface PartOverrides {
  manufacturer?: string;
  model?: string;
  performanceTier?: number;
  benchmarkScore?: number | null;
  tdpWatts?: number | null;
  transientMultiplier?: number | null;
  lengthMm?: number | null;
  widthMm?: number | null;
  heightMm?: number | null;
  dataConfidence?: "VERIFIED" | "INFERRED" | "UNVERIFIED";
  quantity?: number;
  unitPricePaisaSnapshot?: number;
  connectors?: Array<{
    direction: ConnectorDirection;
    connectorType: ConnectorType;
    quantity: number;
  }>;
}

function part(
  partType: PartType,
  slotKey: string,
  specs: Record<string, unknown>,
  overrides: PartOverrides = {},
): SelectedPart {
  return {
    slotKey,
    quantity: overrides.quantity ?? 1,
    isUserSelected: true,
    unitPricePaisaSnapshot: overrides.unitPricePaisaSnapshot ?? 0,
    part: {
      id: `part_${String(nextId++)}`,
      partType,
      manufacturer: overrides.manufacturer ?? "Test",
      model: overrides.model ?? `${partType} ${slotKey}`,
      specs,
      performanceTier: overrides.performanceTier ?? 5,
      benchmarkScore: overrides.benchmarkScore ?? null,
      tdpWatts: overrides.tdpWatts ?? null,
      idleWatts: null,
      loadWatts: null,
      transientMultiplier: overrides.transientMultiplier ?? null,
      lengthMm: overrides.lengthMm ?? null,
      widthMm: overrides.widthMm ?? null,
      heightMm: overrides.heightMm ?? null,
      dataConfidence: overrides.dataConfidence ?? "VERIFIED",
      connectors: overrides.connectors ?? [],
    },
  };
}

function defaultSettings(overrides: Partial<BuildSettings> = {}): BuildSettings {
  return { useCase: "GAMING", targetResolution: "FHD", budgetPaisa: null, ...overrides };
}

function runValidation(parts: SelectedPart[], settings: BuildSettings) {
  const power = computePowerReport(parts);
  const connectorBalance = computeConnectorBalance(parts);
  const balance = computeBalanceReport(parts, settings.targetResolution as BuildResolution);
  const aggregates = buildAggregates(parts, power, connectorBalance, balance);
  const issues = evaluateRules(toRuleRecords(), parts, aggregates, settings);
  const connectorShortfalls = buildConnectorShortfallIssues(connectorBalance);
  return { power, connectorBalance, balance, aggregates, issues, connectorShortfalls };
}

function errors(issues: ReturnType<typeof evaluateRules>) {
  return issues.filter((i) => i.severity === "ERROR");
}

// ---- Reusable fixture parts, loosely matching prisma/seed/builder.ts's real data ----

const CPU_LGA1700 = () =>
  part(
    "CPU",
    "cpu",
    {
      socket: "LGA1700",
      tdpWatts: 65,
      maxTurboPowerWatts: 148,
      supportedRamTypes: ["DDR4", "DDR5"],
      integratedGraphics: { present: false },
      includedCooler: { present: false },
    },
    { model: "Core i5-13400F", tdpWatts: 65, performanceTier: 6 },
  );

const CPU_AM5 = () =>
  part(
    "CPU",
    "cpu",
    {
      socket: "AM5",
      tdpWatts: 65,
      maxTurboPowerWatts: 88,
      supportedRamTypes: ["DDR5"],
      integratedGraphics: { present: true },
      includedCooler: { present: true, adequateUpToTdpWatts: 65 },
    },
    { model: "Ryzen 5 7600", tdpWatts: 65, performanceTier: 7 },
  );

const MOBO_LGA1700_MATX = () =>
  part(
    "MOTHERBOARD",
    "motherboard",
    {
      socket: "LGA1700",
      formFactor: "MICRO_ATX",
      ramType: "DDR4",
      ramSlots: 4,
      maxRamCapacityGb: 128,
      maxRamSpeedMhz: 5333,
      maxCpuTdpRecommendedWatts: 125,
      pcieSlots: [{ version: 4, lanes: 16, physicalSize: "x16", position: 0, isFromCpu: true }],
      m2Slots: [{ key: "M", maxLengthMm: 2280, supportsSata: false }],
      sataPorts: 4,
    },
    { model: "Prime B760M-K" },
  );

const MOBO_AM5_MATX = () =>
  part(
    "MOTHERBOARD",
    "motherboard",
    {
      socket: "AM5",
      formFactor: "MICRO_ATX",
      ramType: "DDR5",
      ramSlots: 4,
      maxRamCapacityGb: 128,
      maxRamSpeedMhz: 6400,
      maxCpuTdpRecommendedWatts: 105,
      pcieSlots: [{ version: 4, lanes: 16, physicalSize: "x16", position: 0, isFromCpu: true }],
      m2Slots: [
        { key: "M", maxLengthMm: 2280, supportsSata: false },
        { key: "M", maxLengthMm: 2280, supportsSata: false },
      ],
      sataPorts: 4,
    },
    { model: "PRO B650M-A WiFi" },
  );

const RAM_DDR4_2X8 = () =>
  part("RAM", "ram", {
    type: "DDR4",
    speedMhz: 3200,
    stickCount: 2,
    capacityPerStickGb: 8,
    totalCapacityGb: 16,
    profileType: "XMP",
    heightMm: 34,
  });

const RAM_DDR5_2X16 = () =>
  part("RAM", "ram", {
    type: "DDR5",
    speedMhz: 5600,
    stickCount: 2,
    capacityPerStickGb: 16,
    totalCapacityGb: 32,
    profileType: "XMP",
    heightMm: 34,
  });

const GPU_RX7600 = () =>
  part(
    "GPU",
    "gpu",
    {
      chipset: "RX 7600",
      vramGb: 8,
      lengthMm: 225,
      heightMm: 120,
      thicknessSlots: 2,
      tdpWatts: 165,
      transientMultiplier: 1.5,
    },
    {
      model: "Pulse Radeon RX 7600 8GB",
      tdpWatts: 165,
      transientMultiplier: 1.5,
      lengthMm: 225,
      performanceTier: 5,
      connectors: [{ direction: "REQUIRES", connectorType: "PCIE_8PIN", quantity: 1 }],
    },
  );

const GPU_RTX4070 = () =>
  part(
    "GPU",
    "gpu",
    {
      chipset: "RTX 4070",
      vramGb: 12,
      lengthMm: 267,
      heightMm: 135,
      thicknessSlots: 2.5,
      tdpWatts: 200,
      transientMultiplier: 1.7,
    },
    {
      model: "Dual GeForce RTX 4070 OC 12GB",
      tdpWatts: 200,
      transientMultiplier: 1.7,
      lengthMm: 267,
      performanceTier: 8,
      connectors: [{ direction: "REQUIRES", connectorType: "PCIE_12VHPWR", quantity: 1 }],
    },
  );

const GPU_RTX5090 = () =>
  part(
    "GPU",
    "gpu",
    {
      chipset: "RTX 5090",
      vramGb: 32,
      lengthMm: 357,
      heightMm: 150,
      thicknessSlots: 3.5,
      tdpWatts: 575,
      transientPeakWatts: 1050,
      transientMultiplier: 1.8,
    },
    {
      model: "RTX 5090 32GB OC",
      tdpWatts: 575,
      transientMultiplier: 1.8,
      lengthMm: 357,
      performanceTier: 10,
      connectors: [{ direction: "REQUIRES", connectorType: "PCIE_12V2X6", quantity: 1 }],
    },
  );

const STORAGE_NVME = () =>
  part("STORAGE", "storage_1", {
    formFactor: "M2_2280",
    interface: "NVME_PCIE4",
    capacityGb: 1000,
  });

const PSU_750W = () =>
  part(
    "PSU",
    "psu",
    { wattage: 750, formFactor: "ATX", modularity: "FULL", qualityTier: "EXCELLENT" },
    {
      model: "RM750x",
      connectors: [
        { direction: "PROVIDES", connectorType: "ATX_24PIN", quantity: 1 },
        { direction: "PROVIDES", connectorType: "EPS_8PIN", quantity: 2 },
        { direction: "PROVIDES", connectorType: "PCIE_8PIN", quantity: 4 },
      ],
    },
  );

const PSU_450W_BUDGET = () =>
  part(
    "PSU",
    "psu",
    { wattage: 450, formFactor: "ATX", modularity: "NON", qualityTier: "BUDGET" },
    {
      model: "Value 450",
      connectors: [
        { direction: "PROVIDES", connectorType: "ATX_24PIN", quantity: 1 },
        { direction: "PROVIDES", connectorType: "EPS_8PIN", quantity: 1 },
        { direction: "PROVIDES", connectorType: "PCIE_8PIN", quantity: 1 },
      ],
    },
  );

const CASE_MIDTOWER = () =>
  part(
    "CASE",
    "case",
    {
      formFactor: "MID_TOWER",
      supportedMotherboardFormFactors: ["ATX", "MICRO_ATX", "MINI_ITX"],
      maxGpuLengthMm: 381,
      gpuSlotCount: 7,
      maxCpuCoolerHeightMm: 165,
      psuFormFactors: ["ATX", "SFX"],
      radiatorSupport: [{ position: "TOP", sizes: [120, 140, 240, 280], maxThicknessMm: 30 }],
      fanMounts: [{ position: "FRONT", size: 120, maxCount: 2 }],
      driveBays: { m2ViaMobo: true, ssd25: 2, hdd35: 1 },
    },
    { model: "H510" },
  );

const CASE_MINI_ITX = () =>
  part(
    "CASE",
    "case",
    {
      formFactor: "SFF",
      supportedMotherboardFormFactors: ["MINI_ITX"],
      maxGpuLengthMm: 330,
      gpuSlotCount: 2,
      maxCpuCoolerHeightMm: 155,
      psuFormFactors: ["SFX", "SFX_L"],
      radiatorSupport: [{ position: "FRONT", sizes: [120, 140, 240], maxThicknessMm: 27 }],
      fanMounts: [{ position: "FRONT", size: 120, maxCount: 2 }],
      driveBays: { m2ViaMobo: true, ssd25: 2, hdd35: 0 },
    },
    { model: "NR200P" },
  );

const COOLER_AIR = () =>
  part(
    "CPU_COOLER",
    "cpu_cooler",
    {
      type: "AIR",
      supportedSockets: ["LGA1700", "AM5", "AM4"],
      heightMm: 159,
      tdpRatingWatts: 150,
      ramClearanceMm: 46,
    },
    { model: "Hyper 212 Black Edition" },
  );

const COOLER_AIO_240 = () =>
  part(
    "CPU_COOLER",
    "cpu_cooler",
    {
      type: "AIO_LIQUID",
      supportedSockets: ["LGA1700", "AM5", "AM4"],
      radiatorSizeMm: 240,
      radiatorThicknessMm: 27,
      tdpRatingWatts: 250,
    },
    { model: "iCUE H100i RGB Elite (240mm AIO)" },
  );

const COOLER_AIO_420 = () =>
  part(
    "CPU_COOLER",
    "cpu_cooler",
    {
      type: "AIO_LIQUID",
      supportedSockets: ["LGA1700", "AM5", "AM4"],
      radiatorSizeMm: 420,
      radiatorThicknessMm: 30,
      tdpRatingWatts: 400,
    },
    { model: "iCUE H170i Elite LCD XT (420mm AIO)" },
  );

describe("golden builds — known-good", () => {
  it("valid AM5 1440p build produces zero ERROR issues", () => {
    const parts = [
      CPU_AM5(),
      MOBO_AM5_MATX(),
      RAM_DDR5_2X16(),
      GPU_RTX4070(),
      STORAGE_NVME(),
      PSU_750W(),
      CASE_MIDTOWER(),
      COOLER_AIR(),
    ];
    const { issues } = runValidation(parts, defaultSettings({ targetResolution: "QHD" }));
    expect(errors(issues)).toEqual([]);
  });

  it("valid LGA1700 budget build produces zero ERROR issues", () => {
    const parts = [
      CPU_LGA1700(),
      MOBO_LGA1700_MATX(),
      RAM_DDR4_2X8(),
      GPU_RX7600(),
      STORAGE_NVME(),
      PSU_750W(),
      CASE_MIDTOWER(),
      COOLER_AIR(),
    ];
    const { issues } = runValidation(parts, defaultSettings());
    expect(errors(issues)).toEqual([]);
  });

  it("240mm AIO fits the mid-tower case's top radiator mount (COOLER_RADIATOR_FIT passes)", () => {
    const parts = [
      CPU_AM5(),
      MOBO_AM5_MATX(),
      RAM_DDR5_2X16(),
      GPU_RTX4070(),
      STORAGE_NVME(),
      PSU_750W(),
      CASE_MIDTOWER(),
      COOLER_AIO_240(),
    ];
    const { issues } = runValidation(parts, defaultSettings());
    expect(issues.find((i) => i.ruleCode === "COOLER_RADIATOR_FIT")).toBeUndefined();
  });

  it("12VHPWR GPU on an 8-pin-only PSU is satisfied via adapter, not a hard shortfall", () => {
    const parts = [
      CPU_AM5(),
      MOBO_AM5_MATX(),
      RAM_DDR5_2X16(),
      GPU_RTX4070(),
      STORAGE_NVME(),
      PSU_750W(),
      CASE_MIDTOWER(),
      COOLER_AIR(),
    ];
    const { connectorBalance } = runValidation(parts, defaultSettings());
    expect(connectorBalance.PCIE_12VHPWR?.satisfied).toBe(false);
    expect(connectorBalance.PCIE_12VHPWR?.satisfiedWithAdapter).toBe(true);
  });
});

describe("golden builds — known-bad", () => {
  it("REFERENCE FIXTURE (docs §12): mATX board + 420mm AIO + flagship GPU in a Mini-ITX case produces >= 3 ERRORs", () => {
    const parts = [
      CPU_LGA1700(),
      MOBO_LGA1700_MATX(), // Micro-ATX board...
      RAM_DDR4_2X8(),
      GPU_RTX5090(), // ...357mm GPU...
      STORAGE_NVME(),
      PSU_750W(), // ...ATX PSU...
      CASE_MINI_ITX(), // ...crammed into a Mini-ITX-only case...
      COOLER_AIO_420(), // ...with a 420mm radiator the case can't mount.
    ];
    const { issues, connectorShortfalls } = runValidation(parts, defaultSettings());
    const errorIssues = errors(issues);
    const errorCodes = errorIssues.map((i) => i.ruleCode);

    expect(errorCodes).toContain("CASE_MOBO_FORM_FACTOR");
    expect(errorCodes).toContain("GPU_CASE_LENGTH");
    expect(errorCodes).toContain("COOLER_RADIATOR_FIT");
    expect(errorCodes).toContain("CASE_PSU_FORM_FACTOR");
    expect(
      errorIssues.length + connectorShortfalls.filter((s) => s.severity === "ERROR").length,
    ).toBeGreaterThanOrEqual(3);
  });

  it("mismatched CPU/motherboard sockets fires exactly CPU_MOBO_SOCKET", () => {
    const parts = [
      CPU_LGA1700(),
      MOBO_AM5_MATX(),
      RAM_DDR5_2X16(),
      STORAGE_NVME(),
      PSU_750W(),
      CASE_MIDTOWER(),
      COOLER_AIR(),
    ];
    const { issues } = runValidation(parts, defaultSettings());
    const socketIssue = issues.find((i) => i.ruleCode === "CPU_MOBO_SOCKET");
    expect(socketIssue).toBeDefined();
    expect(socketIssue?.severity).toBe("ERROR");
  });

  it("RAM type mismatch (DDR5 kit on a DDR4 board) fires RAM_MOBO_TYPE", () => {
    const parts = [
      CPU_LGA1700(),
      MOBO_LGA1700_MATX(),
      RAM_DDR5_2X16(),
      STORAGE_NVME(),
      PSU_750W(),
      CASE_MIDTOWER(),
      COOLER_AIR(),
    ];
    const { issues } = runValidation(parts, defaultSettings());
    expect(issues.find((i) => i.ruleCode === "RAM_MOBO_TYPE")).toBeDefined();
  });

  it("4-stick kit on a board with only 2 free slots fires RAM_MOBO_SLOTS", () => {
    const ram = part("RAM", "ram", {
      type: "DDR4",
      speedMhz: 3200,
      stickCount: 4,
      capacityPerStickGb: 8,
      totalCapacityGb: 32,
      heightMm: 34,
    });
    const mobo = part("MOTHERBOARD", "motherboard", {
      socket: "LGA1700",
      formFactor: "MICRO_ATX",
      ramType: "DDR4",
      ramSlots: 2,
      maxRamCapacityGb: 64,
      maxRamSpeedMhz: 3200,
      pcieSlots: [],
      m2Slots: [],
      sataPorts: 2,
    });
    const { issues } = runValidation([mobo, ram], defaultSettings());
    expect(issues.find((i) => i.ruleCode === "RAM_MOBO_SLOTS")).toBeDefined();
  });

  it("a PSU too weak for the build's peak load fires PSU_TOTAL_POWER", () => {
    const parts = [
      CPU_AM5(),
      MOBO_AM5_MATX(),
      RAM_DDR5_2X16(),
      GPU_RTX4070(),
      STORAGE_NVME(),
      PSU_450W_BUDGET(),
      CASE_MIDTOWER(),
      COOLER_AIR(),
    ];
    const { issues, power } = runValidation(parts, defaultSettings());
    expect(power.peakLoadWatts).toBeGreaterThan(450);
    const psuIssue = issues.find((i) => i.ruleCode === "PSU_TOTAL_POWER");
    expect(psuIssue).toBeDefined();
    expect(psuIssue?.severity).toBe("ERROR");
  });

  it("a budget PSU paired with a high-tier GPU fires PSU_QUALITY (non-blocking)", () => {
    const parts = [
      CPU_AM5(),
      MOBO_AM5_MATX(),
      RAM_DDR5_2X16(),
      GPU_RTX5090(),
      STORAGE_NVME(),
      PSU_450W_BUDGET(),
      CASE_MIDTOWER(),
      COOLER_AIR(),
    ];
    const { issues } = runValidation(parts, defaultSettings());
    const qualityIssue = issues.find((i) => i.ruleCode === "PSU_QUALITY");
    expect(qualityIssue).toBeDefined();
    expect(qualityIssue?.isBlocking).toBe(false);
  });

  it("a single RAM stick fires RAM_CHANNEL_SUBOPTIMAL (non-blocking)", () => {
    const ram = part("RAM", "ram", {
      type: "DDR5",
      speedMhz: 5600,
      stickCount: 1,
      capacityPerStickGb: 16,
      totalCapacityGb: 16,
      profileType: "JEDEC",
      heightMm: 34,
    });
    const { issues } = runValidation([ram], defaultSettings());
    const channelIssue = issues.find((i) => i.ruleCode === "RAM_CHANNEL_SUBOPTIMAL");
    expect(channelIssue).toBeDefined();
    expect(channelIssue?.isBlocking).toBe(false);
  });

  it("a CPU with no integrated graphics and no discrete GPU fires GPU_REQUIRED", () => {
    const parts = [CPU_LGA1700(), MOBO_LGA1700_MATX()];
    const { issues } = runValidation(parts, defaultSettings());
    const gpuRequired = issues.find((i) => i.ruleCode === "GPU_REQUIRED");
    expect(gpuRequired).toBeDefined();
    expect(gpuRequired?.severity).toBe("ERROR");
  });

  it("a motherboard with no x16 slot fires GPU_MOBO_SLOT", () => {
    const mobo = part("MOTHERBOARD", "motherboard", {
      socket: "LGA1700",
      formFactor: "MICRO_ATX",
      ramType: "DDR4",
      ramSlots: 4,
      maxRamCapacityGb: 128,
      maxRamSpeedMhz: 3200,
      pcieSlots: [{ version: 3, lanes: 1, physicalSize: "x1", position: 0, isFromCpu: false }],
      m2Slots: [],
      sataPorts: 4,
    });
    const parts = [mobo, GPU_RX7600()];
    const { issues } = runValidation(parts, defaultSettings());
    expect(issues.find((i) => i.ruleCode === "GPU_MOBO_SLOT")).toBeDefined();
  });
});

describe("power model", () => {
  it("computes transient peak load as baseLoad - gpuTdp + transientPeak", () => {
    const parts = [
      CPU_AM5(),
      MOBO_AM5_MATX(),
      RAM_DDR5_2X16(),
      GPU_RTX4070(),
      STORAGE_NVME(),
      PSU_750W(),
      CASE_MIDTOWER(),
      COOLER_AIR(),
    ];
    const power = computePowerReport(parts);
    const transientPeak = 200 * 1.7; // GPU tdpWatts * transientMultiplier, no explicit transientPeakWatts override
    const expectedPeak = Math.round(power.baseLoadWatts - 200 + transientPeak);
    expect(power.peakLoadWatts).toBe(expectedPeak);
  });

  it("rounds the recommended wattage up to a standard PSU size", () => {
    const parts = [
      CPU_AM5(),
      MOBO_AM5_MATX(),
      RAM_DDR5_2X16(),
      GPU_RTX5090(),
      STORAGE_NVME(),
      PSU_750W(),
      CASE_MIDTOWER(),
      COOLER_AIR(),
    ];
    const power = computePowerReport(parts);
    expect([450, 550, 650, 750, 850, 1000, 1200, 1600]).toContain(power.recommendedPsuWatts);
  });
});

describe("balance model", () => {
  it("applies docs §6's exact weight table: adjusted = balance * (1 - weight), largest magnitude at UHD for a fixed score gap", () => {
    // See balance-model.ts's own header comment: with flat, non-resolution
    // -aware scores (no seeded part has per-resolution benchmark data yet),
    // `(1 - weight)` is *largest* at UHD (0.75) and *smallest* at FHD
    // (0.45), so a fixed raw score gap reads as more severe at UHD, not
    // less — faithful to the literal §6 formula.
    const strongGpu = GPU_RTX5090();
    const weakCpu = part("CPU", "cpu", { socket: "AM5" }, { performanceTier: 2 });
    const parts = [weakCpu, strongGpu];

    const uhd = computeBalanceReport(parts, "UHD");
    const fhd = computeBalanceReport(parts, "FHD");

    expect(uhd.rawBalance).toBe(fhd.rawBalance);
    expect(uhd.adjustedBalance).toBeCloseTo(uhd.rawBalance * 0.75, 5);
    expect(fhd.adjustedBalance).toBeCloseTo(fhd.rawBalance * 0.45, 5);
    expect(Math.abs(uhd.adjustedBalance)).toBeGreaterThan(Math.abs(fhd.adjustedBalance));
    // rawBalance > 0 (gpuScore > cpuScore) is labeled a CPU bottleneck —
    // the GPU has headroom the CPU can't feed it — per verdictFor's own
    // comment in balance-model.ts.
    expect(uhd.verdict).toBe("CPU_BOTTLENECK_SEVERE"); // |60| > 40
    expect(fhd.verdict).toBe("CPU_BOTTLENECK_MODERATE"); // 26 <= |36| <= 40
  });

  it("a well-matched CPU/GPU pair reads as BALANCED at every resolution", () => {
    const parts = [
      part("CPU", "cpu", {}, { performanceTier: 7 }),
      part("GPU", "gpu", {}, { performanceTier: 7 }),
    ];
    for (const resolution of ["FHD", "QHD", "UHD"] as const) {
      expect(computeBalanceReport(parts, resolution).verdict).toBe("BALANCED");
    }
  });
});

describe("cross-build rules", () => {
  it("BUILD_UPGRADE_HEADROOM fires (as an informational positive note) when DIMM/M.2 slots are free", () => {
    const parts = [CPU_LGA1700(), MOBO_LGA1700_MATX(), RAM_DDR4_2X8()];
    const { issues } = runValidation(parts, defaultSettings());
    const headroom = issues.find((i) => i.ruleCode === "BUILD_UPGRADE_HEADROOM");
    expect(headroom).toBeDefined();
    expect(headroom?.severity).toBe("INFO");
  });

  it("BUILD_BUDGET_EXCEEDED fires when the running total is over the stated budget", () => {
    const gpu = GPU_RTX4070();
    gpu.unitPricePaisaSnapshot = 10_000_00;
    const parts = [CPU_AM5(), gpu];
    const { issues } = runValidation(parts, defaultSettings({ budgetPaisa: 5_000_00 }));
    expect(issues.find((i) => i.ruleCode === "BUILD_BUDGET_EXCEEDED")).toBeDefined();
  });
});
