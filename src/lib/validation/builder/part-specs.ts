/**
 * `ComponentPart.specs` schemas — docs/08-PC-BUILDER-ENGINE.md §3: "Each
 * `partType` has a Zod schema. Writes that fail validation are rejected —
 * the import pipeline sends the row to a review queue rather than
 * guessing." This file is that schema set, one per `PartType`, plus the
 * `partSpecSchemaFor`/`parsePartSpecs` entry points every writer (the seed,
 * the admin part form, a future CSV import) must go through.
 *
 * Field names and enum values follow docs/08 §3's tables as closely as a
 * real Zod schema allows — a handful of docs enums are written with a
 * trailing "..." (e.g. CPU socket, GPU output type) to signal "not
 * exhaustive"; this file lists every value actually needed by this
 * session's seed data and rule catalogue plus the common Nepal-market
 * options, and can grow without a migration (specs is a JSON column).
 *
 * Deliberately NOT covered by a typed schema here: `MONITOR` support is
 * scoped out of this pass (docs §2's `monitor_1..3` slot is optional and
 * this session's rule catalogue has no monitor-port rule wired yet — see
 * this module's own `builder/rule-catalogue.ts` header for the full list
 * of what's deferred). A minimal passthrough schema is still provided so
 * a monitor part can at least be catalogued without crashing the union.
 */
import { z } from "zod";

// ---- CPU --------------------------------------------------------------------

export const cpuSocketSchema = z.enum([
  "AM4",
  "AM5",
  "LGA1700",
  "LGA1851",
  "LGA1200",
  "sTR5",
  "sTRX4",
]);
export type CpuSocket = z.infer<typeof cpuSocketSchema>;

export const ramTypeSchema = z.enum(["DDR4", "DDR5"]);
export type RamType = z.infer<typeof ramTypeSchema>;

export const cpuSpecSchema = z.object({
  socket: cpuSocketSchema,
  brand: z.enum(["AMD", "INTEL"]),
  family: z.string().optional(),
  model: z.string().optional(),
  coreCount: z.number().int().positive(),
  pCoreCount: z.number().int().positive().optional(),
  eCoreCount: z.number().int().nonnegative().optional(),
  threadCount: z.number().int().positive(),
  baseClockMhz: z.number().positive().optional(),
  boostClockMhz: z.number().positive().optional(),
  tdpWatts: z.number().positive(),
  maxTurboPowerWatts: z.number().positive().optional(),
  supportedRamTypes: z.array(ramTypeSchema).min(1),
  maxRamSpeedMhz: z.number().positive().optional(),
  maxRamCapacityGb: z.number().positive().optional(),
  memoryChannels: z.number().int().positive().default(2),
  pcieVersion: z.number().positive().optional(),
  pcieLanes: z.number().int().positive().optional(),
  integratedGraphics: z.object({ present: z.boolean(), model: z.string().optional() }),
  includedCooler: z.object({
    present: z.boolean(),
    adequateUpToTdpWatts: z.number().positive().optional(),
  }),
  requiresDiscreteGpu: z.boolean().default(false),
  unlockedMultiplier: z.boolean().default(false),
  performanceTier: z.number().int().min(1).max(10),
});
export type CpuSpec = z.infer<typeof cpuSpecSchema>;

// ---- Motherboard --------------------------------------------------------------

export const motherboardFormFactorSchema = z.enum(["ATX", "MICRO_ATX", "MINI_ITX", "E_ATX"]);
export type MotherboardFormFactor = z.infer<typeof motherboardFormFactorSchema>;

const pcieSlotSchema = z.object({
  version: z.number().positive(),
  lanes: z.number().int().positive(),
  physicalSize: z.enum(["x16", "x8", "x4", "x1"]),
  position: z.number().int().nonnegative(),
  isFromCpu: z.boolean(),
});

const m2SlotSchema = z.object({
  key: z.enum(["M", "B", "B+M"]),
  maxLengthMm: z.number().int().min(2242).max(22110),
  pcieVersion: z.number().positive().optional(),
  lanes: z.number().int().positive().optional(),
  supportsSata: z.boolean().default(false),
  sharesBandwidthWith: z.string().optional(),
});

export const motherboardSpecSchema = z.object({
  socket: cpuSocketSchema,
  chipset: z.string(),
  formFactor: motherboardFormFactorSchema,
  ramType: ramTypeSchema,
  ramSlots: z.number().int().positive(),
  maxRamCapacityGb: z.number().positive(),
  maxRamSpeedMhz: z.number().positive(),
  memoryChannels: z.number().int().positive().default(2),
  pcieSlots: z.array(pcieSlotSchema).default([]),
  m2Slots: z.array(m2SlotSchema).default([]),
  sataPorts: z.number().int().nonnegative().default(0),
  usbHeaders: z
    .object({
      usb2: z.number().int().nonnegative().default(0),
      usb3Gen1: z.number().int().nonnegative().default(0),
      usb3Gen2: z.number().int().nonnegative().default(0),
      typeC: z.number().int().nonnegative().default(0),
    })
    .default({ usb2: 0, usb3Gen1: 0, usb3Gen2: 0, typeC: 0 }),
  fanHeaders: z.number().int().nonnegative().default(0),
  argbHeaders: z.number().int().nonnegative().default(0),
  rgbHeaders: z.number().int().nonnegative().default(0),
  vrmTier: z.enum(["BASIC", "STANDARD", "ENHANCED", "PREMIUM"]),
  vrmPhases: z.number().int().positive().optional(),
  maxCpuTdpRecommendedWatts: z.number().positive().optional(),
  cpuPowerConnectors: z
    .array(z.object({ type: z.enum(["EPS_8PIN", "EPS_4PIN"]), count: z.number().int().positive() }))
    .default([{ type: "EPS_8PIN", count: 1 }]),
  onboardWifi: z.boolean().default(false),
  onboardBluetooth: z.boolean().default(false),
  ethernetSpeedMbps: z.number().positive().optional(),
  rearPorts: z.array(z.string()).default([]),
  biosFlashback: z.boolean().default(false),
  supportedCpuList: z.array(z.string()).optional(),
});
export type MotherboardSpec = z.infer<typeof motherboardSpecSchema>;

// ---- RAM ------------------------------------------------------------------

export const ramSpecSchema = z.object({
  type: ramTypeSchema,
  speedMhz: z.number().int().positive(),
  casLatency: z.number().int().positive().optional(),
  stickCount: z.number().int().positive(),
  capacityPerStickGb: z.number().positive(),
  totalCapacityGb: z.number().positive(),
  voltage: z.number().positive().optional(),
  profileType: z.enum(["XMP", "EXPO", "JEDEC"]).default("JEDEC"),
  profileSpeedMhz: z.number().int().positive().optional(),
  heightMm: z.number().positive().default(34),
  eccSupport: z.boolean().default(false),
  registered: z.boolean().default(false),
});
export type RamSpec = z.infer<typeof ramSpecSchema>;

// ---- GPU --------------------------------------------------------------------

export const gpuPowerConnectorTypeSchema = z.enum([
  "PCIE_8PIN",
  "PCIE_6PIN",
  "PCIE_12VHPWR",
  "PCIE_12V2X6",
]);

export const gpuSpecSchema = z.object({
  chipset: z.string(),
  brand: z.enum(["NVIDIA", "AMD", "INTEL"]),
  vramGb: z.number().positive(),
  vramType: z.string().optional(),
  lengthMm: z.number().positive(),
  heightMm: z.number().positive().optional(),
  thicknessSlots: z.number().positive(),
  pcieVersion: z.number().positive().optional(),
  pcieLanes: z.number().int().positive().optional(),
  tdpWatts: z.number().positive(),
  transientPeakWatts: z.number().positive().optional(),
  transientMultiplier: z.number().positive().default(1.8),
  recommendedPsuWatts: z.number().positive().optional(),
  powerConnectors: z
    .array(z.object({ type: gpuPowerConnectorTypeSchema, count: z.number().int().positive() }))
    .default([]),
  outputs: z
    .array(
      z.object({
        type: z.enum(["HDMI", "DISPLAYPORT", "USB_C"]),
        version: z.string().optional(),
        count: z.number().int().positive(),
      }),
    )
    .default([]),
  maxDisplays: z.number().int().positive().default(4),
  performanceTier: z.number().int().min(1).max(10),
  benchmark1080p: z.number().positive().optional(),
  benchmark1440p: z.number().positive().optional(),
  benchmark2160p: z.number().positive().optional(),
  coolerType: z.enum(["BLOWER", "OPEN_AIR", "AIO", "PASSIVE"]).default("OPEN_AIR"),
  atx3Recommended: z.boolean().default(false),
});
export type GpuSpec = z.infer<typeof gpuSpecSchema>;

// ---- Storage ----------------------------------------------------------------

export const storageFormFactorSchema = z.enum([
  "M2_2280",
  "M2_2242",
  "M2_22110",
  "SATA_2_5",
  "SATA_3_5",
  "PCIE_AIC",
]);
export type StorageFormFactor = z.infer<typeof storageFormFactorSchema>;

export const storageInterfaceSchema = z.enum(["NVME_PCIE3", "NVME_PCIE4", "NVME_PCIE5", "SATA3"]);
export type StorageInterface = z.infer<typeof storageInterfaceSchema>;

export const storageSpecSchema = z.object({
  formFactor: storageFormFactorSchema,
  interface: storageInterfaceSchema,
  m2Key: z.enum(["M", "B", "B+M"]).optional(),
  capacityGb: z.number().positive(),
  seqReadMbs: z.number().positive().optional(),
  seqWriteMbs: z.number().positive().optional(),
  dramCache: z.boolean().default(false),
  tbwRating: z.number().positive().optional(),
  heightMm: z.number().positive().optional(),
});
export type StorageSpec = z.infer<typeof storageSpecSchema>;

// ---- PSU --------------------------------------------------------------------

export const psuFormFactorSchema = z.enum(["ATX", "SFX", "SFX_L", "TFX"]);
export type PsuFormFactor = z.infer<typeof psuFormFactorSchema>;

export const psuConnectorTypeSchema = z.enum([
  "ATX_24PIN",
  "EPS_8PIN",
  "PCIE_8PIN",
  "PCIE_12VHPWR",
  "PCIE_12V2X6",
  "SATA_POWER",
  "MOLEX",
]);

export const psuSpecSchema = z.object({
  wattage: z.number().int().positive(),
  efficiencyRating: z.enum([
    "80P_WHITE",
    "80P_BRONZE",
    "80P_SILVER",
    "80P_GOLD",
    "80P_PLATINUM",
    "80P_TITANIUM",
  ]),
  formFactor: psuFormFactorSchema,
  lengthMm: z.number().positive().optional(),
  modularity: z.enum(["NON", "SEMI", "FULL"]),
  atx3Compliant: z.boolean().default(false),
  pcie5Ready: z.boolean().default(false),
  connectors: z
    .array(z.object({ type: psuConnectorTypeSchema, count: z.number().int().positive() }))
    .default([]),
  singleRail: z.boolean().default(true),
  plus12vAmps: z.number().positive().optional(),
  qualityTier: z.enum(["BUDGET", "STANDARD", "GOOD", "EXCELLENT"]),
  warrantyYears: z.number().int().nonnegative().optional(),
});
export type PsuSpec = z.infer<typeof psuSpecSchema>;

// ---- CPU Cooler ---------------------------------------------------------------

export const coolerTypeSchema = z.enum(["AIR", "AIO_LIQUID", "CUSTOM_LOOP"]);
export type CoolerType = z.infer<typeof coolerTypeSchema>;

export const radiatorSizeSchema = z.union([
  z.literal(120),
  z.literal(140),
  z.literal(240),
  z.literal(280),
  z.literal(360),
  z.literal(420),
]);

export const cpuCoolerSpecSchema = z.object({
  type: coolerTypeSchema,
  supportedSockets: z.array(cpuSocketSchema).min(1),
  heightMm: z.number().positive().optional(),
  radiatorSizeMm: radiatorSizeSchema.optional(),
  radiatorThicknessMm: z.number().positive().optional(),
  fanCount: z.number().int().nonnegative().optional(),
  fanSizeMm: z.number().positive().optional(),
  tdpRatingWatts: z.number().positive(),
  ramClearanceMm: z.number().positive().optional(),
  noiseDb: z.number().positive().optional(),
  requiresBackplate: z.boolean().default(false),
});
export type CpuCoolerSpec = z.infer<typeof cpuCoolerSpecSchema>;

// ---- Case -----------------------------------------------------------------

export const caseFormFactorSchema = z.enum([
  "FULL_TOWER",
  "MID_TOWER",
  "MINI_TOWER",
  "SFF",
  "HTPC",
]);
export type CaseFormFactor = z.infer<typeof caseFormFactorSchema>;

const radiatorSupportEntrySchema = z.object({
  position: z.enum(["TOP", "FRONT", "REAR", "SIDE", "BOTTOM"]),
  sizes: z.array(radiatorSizeSchema).min(1),
  maxThicknessMm: z.number().positive(),
});

const fanMountSchema = z.object({
  position: z.enum(["TOP", "FRONT", "REAR", "SIDE", "BOTTOM"]),
  size: z.number().positive(),
  maxCount: z.number().int().positive(),
});

export const caseSpecSchema = z.object({
  formFactor: caseFormFactorSchema,
  supportedMotherboardFormFactors: z.array(motherboardFormFactorSchema).min(1),
  maxGpuLengthMm: z.number().positive(),
  maxGpuLengthWithFrontFanMm: z.number().positive().optional(),
  /// GPU_CASE_HEIGHT (docs §4.2) — side-panel clearance above the GPU bracket; optional because not every case spec sheet publishes it.
  maxGpuHeightMm: z.number().positive().optional(),
  gpuSlotCount: z.number().int().positive().default(2),
  verticalGpuSupport: z.boolean().default(false),
  maxCpuCoolerHeightMm: z.number().positive(),
  maxPsuLengthMm: z.number().positive().optional(),
  psuFormFactors: z.array(psuFormFactorSchema).min(1),
  radiatorSupport: z.array(radiatorSupportEntrySchema).default([]),
  fanMounts: z.array(fanMountSchema).default([]),
  includedFans: z.number().int().nonnegative().default(0),
  driveBays: z.object({
    m2ViaMobo: z.boolean().default(true),
    ssd25: z.number().int().nonnegative().default(0),
    hdd35: z.number().int().nonnegative().default(0),
  }),
  frontPanel: z
    .array(
      z.object({ type: z.enum(["USB3", "USB_C", "AUDIO"]), count: z.number().int().positive() }),
    )
    .default([]),
  expansionSlots: z.number().int().nonnegative().default(7),
  psuPosition: z.enum(["TOP", "BOTTOM", "CHAMBER"]).default("BOTTOM"),
  dimensionsMm: z.object({
    l: z.number().positive(),
    w: z.number().positive(),
    h: z.number().positive(),
  }),
  weightKg: z.number().positive().optional(),
  sidePanel: z.enum(["TEMPERED_GLASS", "MESH", "SOLID"]).default("TEMPERED_GLASS"),
});
export type CaseSpec = z.infer<typeof caseSpecSchema>;

// ---- Monitor (minimal passthrough — see file header) -----------------------

export const monitorSpecSchema = z.object({
  sizeInches: z.number().positive().optional(),
  resolution: z.string().optional(),
  refreshRateHz: z.number().positive().optional(),
  panelType: z.enum(["IPS", "VA", "TN", "OLED"]).optional(),
  inputs: z
    .array(
      z.object({
        type: z.enum(["HDMI", "DISPLAYPORT", "USB_C"]),
        version: z.string().optional(),
        count: z.number().int().positive(),
      }),
    )
    .default([]),
  adaptiveSync: z.enum(["NONE", "FREESYNC", "GSYNC", "GSYNC_COMPATIBLE"]).default("NONE"),
});
export type MonitorSpec = z.infer<typeof monitorSpecSchema>;

// ---- Passthrough for everything else (thermal paste, accessories, OS, expansion cards, fans) ----

/** Case fans, OS licences, thermal paste, accessories, and expansion cards carry no compatibility-relevant shape of their own in this pass — the top-level `ComponentPart` columns (`tdpWatts` for a fan's power draw, etc.) cover what the engine actually needs. */
export const genericSpecSchema = z.record(z.string(), z.unknown());

export const CASE_FAN_SPEC_SCHEMA = z.object({
  sizeMm: z.number().positive().optional(),
  connectorType: z.enum(["FAN_4PIN", "ARGB_3PIN", "RGB_4PIN"]).default("FAN_4PIN"),
  static: z.boolean().optional(),
});

// ---- Discriminated dispatch -------------------------------------------------

export const PART_SPEC_SCHEMAS = {
  CPU: cpuSpecSchema,
  MOTHERBOARD: motherboardSpecSchema,
  RAM: ramSpecSchema,
  GPU: gpuSpecSchema,
  STORAGE: storageSpecSchema,
  PSU: psuSpecSchema,
  CPU_COOLER: cpuCoolerSpecSchema,
  CASE: caseSpecSchema,
  CASE_FAN: CASE_FAN_SPEC_SCHEMA,
  MONITOR: monitorSpecSchema,
  OS: genericSpecSchema,
  CAPTURE_CARD: genericSpecSchema,
  SOUND_CARD: genericSpecSchema,
  NETWORK_CARD: genericSpecSchema,
  THERMAL_PASTE: genericSpecSchema,
  ACCESSORY: genericSpecSchema,
} as const;

export type BuilderPartType = keyof typeof PART_SPEC_SCHEMAS;

/** The one function every writer of `ComponentPart.specs` must call — docs/08 §3's "writes that fail validation are rejected" rule, enforced here rather than left to callers to remember. */
export function parsePartSpecs(partType: BuilderPartType, specs: unknown) {
  // eslint-disable-next-line security/detect-object-injection -- `partType` is typed `BuilderPartType`, a closed union of the 16 `PartType` enum values, never arbitrary input.
  const schema = PART_SPEC_SCHEMAS[partType];
  return schema.parse(specs);
}

export function safeParsePartSpecs(partType: BuilderPartType, specs: unknown) {
  // eslint-disable-next-line security/detect-object-injection -- `partType` is typed `BuilderPartType`, a closed union of the 16 `PartType` enum values, never arbitrary input.
  const schema = PART_SPEC_SCHEMAS[partType];
  return schema.safeParse(specs);
}
