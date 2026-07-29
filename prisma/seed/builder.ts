/**
 * DEV-ONLY SEED DATA — 25 builder parts (reduced from the blueprint's
 * suggested 60 per docs/06-DATA-MODEL.md §13.3, same scope reduction the
 * original Phase-4 pass made; extend before a wide real-catalogue QA
 * pass). Every part's `specs` is parsed through `part-specs.ts`'s real
 * Zod schemas before being written — a typo in this file fails the seed
 * loudly instead of silently reaching the database, which is the whole
 * point of "writes that fail validation are rejected" (docs §3).
 *
 * REWRITTEN for Phase 8 (PC Builder Engine): the previous pass's specs
 * used simplified, inconsistent field names (`memoryType`, `storageType`,
 * `modular`, free-string form factors) that didn't match a real schema,
 * and its `CASE` parts had no `maxGpuLengthMm` at all despite the
 * `GPU_LENGTH_FITS_CASE` rule already referencing it — a latent bug this
 * rewrite fixes by construction (every field a rule reads is now
 * Zod-validated to exist with the right shape).
 *
 * Three parts are new this pass, added specifically so the mandatory
 * "reference app's invalid build" golden fixture (docs §12: mATX board +
 * 420mm AIO + a flagship GPU in a Mini-ITX case must produce >= 3 ERRORs)
 * has real seeded parts to assemble from, without needing a synthetic
 * fixture built by hand in the test file: the "Astral" RTX 5090-class
 * GPU (too long and too power-hungry for a compact build), the 420mm AIO
 * (no compact case here has a 420mm radiator mount), and the "NR200P"-style
 * Mini-ITX case (SFX-only PSU bay, no room for a 420mm radiator or a
 * 357mm GPU, and doesn't support Micro-ATX at all).
 *
 * Four parts are deliberately the *same physical product* as a catalog.ts
 * demo product (Intel i5-13400F, MSI RTX 4060, the Corsair RAM kit, the
 * Samsung SSD) and are linked via `ComponentPart.variantId`. Every other
 * part is informational-only (`variantId` null), a legitimate state per
 * docs/06 §7.
 *
 * CompatibilityRule seeding now upserts the full catalogue from
 * `src/server/services/builder/rule-catalogue.ts` instead of a
 * hand-picked minimum set — see that file's own header for exactly which
 * of docs §4.2's 50 named checks are DB rows here vs. subsumed by the
 * generic connector pass vs. deferred.
 */
import { db } from "@/server/db";
import { rupeesToPaisa } from "@/lib/money";
import { parsePartSpecs, type BuilderPartType } from "@/lib/validation/builder/part-specs";
import { RULE_CATALOGUE } from "@/server/services/builder/rule-catalogue";
import type {
  PartType,
  ConnectorType,
  ConnectorDirection,
  BuildUseCase,
} from "@/generated/prisma/client";

interface PartInput {
  variantSku?: string;
  partType: BuilderPartType;
  manufacturer: string;
  model: string;
  specs: Record<string, unknown>;
  performanceTier: number;
  tdpWatts?: number;
  idleWatts?: number;
  loadWatts?: number;
  transientMultiplier?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
}

const PARTS: PartInput[] = [
  // ============================= CPU =============================
  {
    variantSku: "INTEL-I5-13400F",
    partType: "CPU",
    manufacturer: "Intel",
    model: "Core i5-13400F",
    performanceTier: 6,
    tdpWatts: 65,
    loadWatts: 148,
    specs: {
      socket: "LGA1700",
      brand: "INTEL",
      coreCount: 10,
      pCoreCount: 6,
      eCoreCount: 4,
      threadCount: 16,
      baseClockMhz: 2500,
      boostClockMhz: 4600,
      tdpWatts: 65,
      maxTurboPowerWatts: 148,
      supportedRamTypes: ["DDR4", "DDR5"],
      maxRamSpeedMhz: 5600,
      maxRamCapacityGb: 128,
      memoryChannels: 2,
      pcieVersion: 4,
      pcieLanes: 20,
      integratedGraphics: { present: false },
      includedCooler: { present: false },
      requiresDiscreteGpu: true,
      unlockedMultiplier: false,
      performanceTier: 6,
    },
  },
  {
    partType: "CPU",
    manufacturer: "Intel",
    model: "Core i7-13700K",
    performanceTier: 9,
    tdpWatts: 125,
    loadWatts: 253,
    specs: {
      socket: "LGA1700",
      brand: "INTEL",
      coreCount: 16,
      pCoreCount: 8,
      eCoreCount: 8,
      threadCount: 24,
      baseClockMhz: 3400,
      boostClockMhz: 5400,
      tdpWatts: 125,
      maxTurboPowerWatts: 253,
      supportedRamTypes: ["DDR4", "DDR5"],
      maxRamSpeedMhz: 5600,
      maxRamCapacityGb: 128,
      pcieVersion: 5,
      pcieLanes: 20,
      integratedGraphics: { present: true, model: "UHD 770" },
      includedCooler: { present: false },
      requiresDiscreteGpu: false,
      unlockedMultiplier: true,
      performanceTier: 9,
    },
  },
  {
    partType: "CPU",
    manufacturer: "AMD",
    model: "Ryzen 5 7600",
    performanceTier: 7,
    tdpWatts: 65,
    loadWatts: 88,
    specs: {
      socket: "AM5",
      brand: "AMD",
      coreCount: 6,
      threadCount: 12,
      baseClockMhz: 3800,
      boostClockMhz: 5100,
      tdpWatts: 65,
      maxTurboPowerWatts: 88,
      supportedRamTypes: ["DDR5"],
      maxRamSpeedMhz: 5200,
      maxRamCapacityGb: 128,
      pcieVersion: 4,
      pcieLanes: 20,
      integratedGraphics: { present: true, model: "Radeon Graphics" },
      includedCooler: { present: true, adequateUpToTdpWatts: 65 },
      requiresDiscreteGpu: false,
      unlockedMultiplier: true,
      performanceTier: 7,
    },
  },
  {
    partType: "CPU",
    manufacturer: "AMD",
    model: "Ryzen 5 5600",
    performanceTier: 5,
    tdpWatts: 65,
    loadWatts: 76,
    specs: {
      socket: "AM4",
      brand: "AMD",
      coreCount: 6,
      threadCount: 12,
      baseClockMhz: 3500,
      boostClockMhz: 4400,
      tdpWatts: 65,
      maxTurboPowerWatts: 76,
      supportedRamTypes: ["DDR4"],
      maxRamSpeedMhz: 3200,
      maxRamCapacityGb: 128,
      pcieVersion: 3,
      pcieLanes: 20,
      integratedGraphics: { present: false },
      includedCooler: { present: true, adequateUpToTdpWatts: 65 },
      requiresDiscreteGpu: true,
      unlockedMultiplier: true,
      performanceTier: 5,
    },
  },

  // ============================= GPU =============================
  {
    variantSku: "MSI-RTX4060-GAMX",
    partType: "GPU",
    manufacturer: "MSI",
    model: "GeForce RTX 4060 Gaming X 8GB",
    performanceTier: 6,
    loadWatts: 115,
    lengthMm: 245,
    heightMm: 126,
    transientMultiplier: 1.5,
    specs: {
      chipset: "RTX 4060",
      brand: "NVIDIA",
      vramGb: 8,
      vramType: "GDDR6",
      lengthMm: 245,
      heightMm: 126,
      thicknessSlots: 2.5,
      pcieVersion: 4,
      pcieLanes: 8,
      tdpWatts: 115,
      transientMultiplier: 1.5,
      recommendedPsuWatts: 550,
      powerConnectors: [{ type: "PCIE_8PIN", count: 1 }],
      outputs: [
        { type: "DISPLAYPORT", version: "1.4a", count: 3 },
        { type: "HDMI", version: "2.1", count: 1 },
      ],
      maxDisplays: 4,
      performanceTier: 6,
      coolerType: "OPEN_AIR",
    },
  },
  {
    partType: "GPU",
    manufacturer: "Asus",
    model: "Dual GeForce RTX 4070 OC 12GB",
    performanceTier: 8,
    loadWatts: 200,
    lengthMm: 267,
    heightMm: 135,
    transientMultiplier: 1.7,
    specs: {
      chipset: "RTX 4070",
      brand: "NVIDIA",
      vramGb: 12,
      vramType: "GDDR6X",
      lengthMm: 267,
      heightMm: 135,
      thicknessSlots: 2.5,
      pcieVersion: 4,
      pcieLanes: 16,
      tdpWatts: 200,
      transientMultiplier: 1.7,
      recommendedPsuWatts: 650,
      // Native 12VHPWR with a bundled 8-pin adapter — exercises
      // `connector-check.ts`'s `ADAPTER_COVERAGE` table against a PSU
      // that only provides 8-pin PCIe.
      powerConnectors: [{ type: "PCIE_12VHPWR", count: 1 }],
      outputs: [
        { type: "DISPLAYPORT", version: "1.4a", count: 3 },
        { type: "HDMI", version: "2.1", count: 1 },
      ],
      maxDisplays: 4,
      performanceTier: 8,
      coolerType: "OPEN_AIR",
      atx3Recommended: true,
    },
  },
  {
    partType: "GPU",
    manufacturer: "Sapphire",
    model: "Pulse Radeon RX 7600 8GB",
    performanceTier: 5,
    loadWatts: 165,
    lengthMm: 225,
    heightMm: 120,
    transientMultiplier: 1.5,
    specs: {
      chipset: "RX 7600",
      brand: "AMD",
      vramGb: 8,
      vramType: "GDDR6",
      lengthMm: 225,
      heightMm: 120,
      thicknessSlots: 2,
      pcieVersion: 4,
      pcieLanes: 8,
      tdpWatts: 165,
      transientMultiplier: 1.5,
      recommendedPsuWatts: 550,
      powerConnectors: [{ type: "PCIE_8PIN", count: 1 }],
      outputs: [
        { type: "DISPLAYPORT", version: "1.4a", count: 3 },
        { type: "HDMI", version: "2.1", count: 1 },
      ],
      maxDisplays: 4,
      performanceTier: 5,
      coolerType: "OPEN_AIR",
    },
  },
  {
    partType: "GPU",
    manufacturer: "Astral",
    model: "RTX 5090 32GB OC",
    performanceTier: 10,
    loadWatts: 575,
    lengthMm: 357,
    heightMm: 150,
    transientMultiplier: 1.8,
    specs: {
      chipset: "RTX 5090",
      brand: "NVIDIA",
      vramGb: 32,
      vramType: "GDDR7",
      lengthMm: 357,
      heightMm: 150,
      thicknessSlots: 3.5,
      pcieVersion: 5,
      pcieLanes: 16,
      tdpWatts: 575,
      transientPeakWatts: 1050,
      transientMultiplier: 1.8,
      recommendedPsuWatts: 1200,
      powerConnectors: [{ type: "PCIE_12V2X6", count: 1 }],
      outputs: [
        { type: "DISPLAYPORT", version: "2.1", count: 3 },
        { type: "HDMI", version: "2.1", count: 1 },
      ],
      maxDisplays: 4,
      performanceTier: 10,
      coolerType: "OPEN_AIR",
      atx3Recommended: true,
    },
  },

  // ============================= MOTHERBOARD =============================
  {
    partType: "MOTHERBOARD",
    manufacturer: "Asus",
    model: "Prime B760M-K",
    performanceTier: 5,
    specs: {
      socket: "LGA1700",
      chipset: "B760",
      formFactor: "MICRO_ATX",
      ramType: "DDR4",
      ramSlots: 4,
      maxRamCapacityGb: 128,
      maxRamSpeedMhz: 5333,
      memoryChannels: 2,
      pcieSlots: [
        { version: 4, lanes: 16, physicalSize: "x16", position: 0, isFromCpu: true },
        { version: 3, lanes: 1, physicalSize: "x1", position: 1, isFromCpu: false },
      ],
      m2Slots: [
        { key: "M", maxLengthMm: 2280, pcieVersion: 4, lanes: 4, supportsSata: false },
        {
          key: "M",
          maxLengthMm: 2280,
          pcieVersion: 3,
          lanes: 4,
          supportsSata: true,
          sharesBandwidthWith: "SATA_5_6",
        },
      ],
      sataPorts: 4,
      usbHeaders: { usb2: 2, usb3Gen1: 1, usb3Gen2: 0, typeC: 1 },
      fanHeaders: 4,
      argbHeaders: 2,
      rgbHeaders: 1,
      vrmTier: "STANDARD",
      vrmPhases: 8,
      maxCpuTdpRecommendedWatts: 125,
      cpuPowerConnectors: [{ type: "EPS_8PIN", count: 1 }],
      onboardWifi: false,
      onboardBluetooth: false,
      ethernetSpeedMbps: 1000,
      rearPorts: [
        "HDMI",
        "DisplayPort",
        "USB3.2 Gen2 Type-C",
        "4x USB3.2",
        "2x USB2.0",
        "RJ45",
        "Audio",
      ],
      biosFlashback: false,
    },
  },
  {
    partType: "MOTHERBOARD",
    manufacturer: "MSI",
    model: "PRO B650M-A WiFi",
    performanceTier: 6,
    specs: {
      socket: "AM5",
      chipset: "B650",
      formFactor: "MICRO_ATX",
      ramType: "DDR5",
      ramSlots: 4,
      maxRamCapacityGb: 128,
      maxRamSpeedMhz: 6400,
      memoryChannels: 2,
      pcieSlots: [{ version: 4, lanes: 16, physicalSize: "x16", position: 0, isFromCpu: true }],
      m2Slots: [
        { key: "M", maxLengthMm: 2280, pcieVersion: 4, lanes: 4, supportsSata: false },
        { key: "M", maxLengthMm: 2280, pcieVersion: 4, lanes: 4, supportsSata: false },
      ],
      sataPorts: 4,
      usbHeaders: { usb2: 1, usb3Gen1: 1, usb3Gen2: 1, typeC: 1 },
      fanHeaders: 5,
      argbHeaders: 2,
      rgbHeaders: 1,
      vrmTier: "ENHANCED",
      vrmPhases: 10,
      maxCpuTdpRecommendedWatts: 105,
      cpuPowerConnectors: [{ type: "EPS_8PIN", count: 1 }],
      onboardWifi: true,
      onboardBluetooth: true,
      ethernetSpeedMbps: 2500,
      rearPorts: ["HDMI", "DisplayPort", "USB-C", "4x USB3.2", "WiFi antenna", "RJ45"],
      biosFlashback: true,
      supportedCpuList: ["Ryzen 5 7600", "Ryzen 7 7700", "Ryzen 9 7900"],
    },
  },
  {
    partType: "MOTHERBOARD",
    manufacturer: "ASRock",
    model: "B550M Pro4",
    performanceTier: 4,
    specs: {
      socket: "AM4",
      chipset: "B550",
      formFactor: "MICRO_ATX",
      ramType: "DDR4",
      ramSlots: 4,
      maxRamCapacityGb: 128,
      maxRamSpeedMhz: 4733,
      memoryChannels: 2,
      pcieSlots: [{ version: 3, lanes: 16, physicalSize: "x16", position: 0, isFromCpu: true }],
      m2Slots: [{ key: "M", maxLengthMm: 2280, pcieVersion: 3, lanes: 4, supportsSata: false }],
      sataPorts: 4,
      usbHeaders: { usb2: 2, usb3Gen1: 1, usb3Gen2: 0, typeC: 0 },
      fanHeaders: 4,
      argbHeaders: 1,
      rgbHeaders: 1,
      vrmTier: "BASIC",
      vrmPhases: 6,
      maxCpuTdpRecommendedWatts: 105,
      cpuPowerConnectors: [{ type: "EPS_8PIN", count: 1 }],
      onboardWifi: false,
      onboardBluetooth: false,
      ethernetSpeedMbps: 1000,
      rearPorts: ["HDMI", "DVI-D", "4x USB3.2", "2x USB2.0", "RJ45", "Audio"],
      biosFlashback: false,
    },
  },

  // ============================= RAM =============================
  {
    variantSku: "CORSAIR-VNG-16GB-3200",
    partType: "RAM",
    manufacturer: "Corsair",
    model: "Vengeance 16GB (2x8GB) DDR4-3200",
    performanceTier: 5,
    heightMm: 34,
    specs: {
      type: "DDR4",
      speedMhz: 3200,
      casLatency: 16,
      stickCount: 2,
      capacityPerStickGb: 8,
      totalCapacityGb: 16,
      voltage: 1.35,
      profileType: "XMP",
      profileSpeedMhz: 3200,
      heightMm: 34,
      eccSupport: false,
      registered: false,
    },
  },
  {
    partType: "RAM",
    manufacturer: "Kingston",
    model: "Fury Beast 32GB (2x16GB) DDR5-5600",
    performanceTier: 7,
    heightMm: 34,
    specs: {
      type: "DDR5",
      speedMhz: 5600,
      casLatency: 36,
      stickCount: 2,
      capacityPerStickGb: 16,
      totalCapacityGb: 32,
      voltage: 1.25,
      profileType: "XMP",
      profileSpeedMhz: 5600,
      heightMm: 34,
      eccSupport: false,
      registered: false,
    },
  },
  {
    partType: "RAM",
    manufacturer: "Corsair",
    model: "Dominator Platinum 32GB (2x16GB) DDR5-6000",
    performanceTier: 8,
    heightMm: 55,
    specs: {
      type: "DDR5",
      speedMhz: 6000,
      casLatency: 30,
      stickCount: 2,
      capacityPerStickGb: 16,
      totalCapacityGb: 32,
      voltage: 1.35,
      profileType: "XMP",
      profileSpeedMhz: 6000,
      // Dominator's tall heatspreaders (55mm vs the 34mm baseline above) —
      // deliberately tall enough to demo `RAM_COOLER_CLEARANCE` if ever
      // paired with the low-clearance Hyper 212 below (46mm).
      heightMm: 55,
      eccSupport: false,
      registered: false,
    },
  },

  // ============================= STORAGE =============================
  {
    variantSku: "SAMSUNG-970EVOP-1TB",
    partType: "STORAGE",
    manufacturer: "Samsung",
    model: "970 EVO Plus 1TB",
    performanceTier: 6,
    specs: {
      formFactor: "M2_2280",
      interface: "NVME_PCIE3",
      m2Key: "M",
      capacityGb: 1000,
      seqReadMbs: 3500,
      seqWriteMbs: 3300,
      dramCache: true,
      tbwRating: 600,
    },
  },
  {
    partType: "STORAGE",
    manufacturer: "WD",
    model: "Black SN770 1TB",
    performanceTier: 7,
    specs: {
      formFactor: "M2_2280",
      interface: "NVME_PCIE4",
      m2Key: "M",
      capacityGb: 1000,
      seqReadMbs: 5150,
      seqWriteMbs: 4900,
      dramCache: false,
      tbwRating: 600,
    },
  },
  {
    partType: "STORAGE",
    manufacturer: "Seagate",
    model: "Barracuda 2TB",
    performanceTier: 2,
    specs: {
      formFactor: "SATA_3_5",
      interface: "SATA3",
      capacityGb: 2000,
      seqReadMbs: 190,
      seqWriteMbs: 190,
      dramCache: false,
      tbwRating: 180,
    },
  },

  // ============================= PSU =============================
  {
    partType: "PSU",
    manufacturer: "Corsair",
    model: "RM750x",
    performanceTier: 7,
    specs: {
      wattage: 750,
      efficiencyRating: "80P_GOLD",
      formFactor: "ATX",
      lengthMm: 160,
      modularity: "FULL",
      atx3Compliant: true,
      pcie5Ready: true,
      connectors: [
        { type: "ATX_24PIN", count: 1 },
        { type: "EPS_8PIN", count: 2 },
        { type: "PCIE_8PIN", count: 4 },
        { type: "SATA_POWER", count: 6 },
        { type: "MOLEX", count: 2 },
      ],
      singleRail: true,
      plus12vAmps: 62,
      qualityTier: "EXCELLENT",
      warrantyYears: 10,
    },
  },
  {
    partType: "PSU",
    manufacturer: "Corsair",
    model: "CV650",
    performanceTier: 4,
    specs: {
      wattage: 650,
      efficiencyRating: "80P_BRONZE",
      formFactor: "ATX",
      lengthMm: 140,
      modularity: "NON",
      atx3Compliant: false,
      pcie5Ready: false,
      connectors: [
        { type: "ATX_24PIN", count: 1 },
        { type: "EPS_8PIN", count: 1 },
        { type: "PCIE_8PIN", count: 2 },
        { type: "SATA_POWER", count: 4 },
        { type: "MOLEX", count: 2 },
      ],
      singleRail: true,
      qualityTier: "STANDARD",
      warrantyYears: 5,
    },
  },

  // ============================= CASE =============================
  {
    partType: "CASE",
    manufacturer: "NZXT",
    model: "H510",
    performanceTier: 5,
    lengthMm: 435,
    widthMm: 210,
    heightMm: 460,
    specs: {
      formFactor: "MID_TOWER",
      supportedMotherboardFormFactors: ["ATX", "MICRO_ATX", "MINI_ITX"],
      maxGpuLengthMm: 381,
      maxGpuLengthWithFrontFanMm: 360,
      maxGpuHeightMm: 159,
      // Matches `expansionSlots` below — a mid tower's rear bracket is the
      // real limit on GPU thickness, not a separate smaller figure. (An
      // earlier pass had this at 2, which made every seeded 2.5-slot-thick
      // GPU fail `GPU_CASE_SLOTS` against every case — caught by
      // `engine.test.ts`'s "known-good" fixtures.)
      gpuSlotCount: 7,
      verticalGpuSupport: false,
      maxCpuCoolerHeightMm: 165,
      maxPsuLengthMm: 180,
      psuFormFactors: ["ATX", "SFX"],
      radiatorSupport: [
        { position: "TOP", sizes: [120, 140, 240, 280], maxThicknessMm: 30 },
        { position: "FRONT", sizes: [120, 140, 240], maxThicknessMm: 30 },
      ],
      fanMounts: [
        { position: "FRONT", size: 120, maxCount: 2 },
        { position: "TOP", size: 120, maxCount: 2 },
        { position: "REAR", size: 120, maxCount: 1 },
      ],
      includedFans: 2,
      driveBays: { m2ViaMobo: true, ssd25: 2, hdd35: 1 },
      frontPanel: [
        { type: "USB3", count: 1 },
        { type: "USB_C", count: 1 },
        { type: "AUDIO", count: 1 },
      ],
      expansionSlots: 7,
      psuPosition: "BOTTOM",
      dimensionsMm: { l: 435, w: 210, h: 460 },
      weightKg: 6.5,
      sidePanel: "TEMPERED_GLASS",
    },
  },
  {
    partType: "CASE",
    manufacturer: "Cooler Master",
    model: "MasterBox Q300L",
    performanceTier: 4,
    lengthMm: 400,
    widthMm: 207,
    heightMm: 366,
    specs: {
      formFactor: "MINI_TOWER",
      supportedMotherboardFormFactors: ["MICRO_ATX", "MINI_ITX"],
      maxGpuLengthMm: 360,
      maxGpuHeightMm: 150,
      gpuSlotCount: 4, // matches `expansionSlots` below, see the H510 comment above
      maxCpuCoolerHeightMm: 159,
      maxPsuLengthMm: 160,
      psuFormFactors: ["ATX", "SFX"],
      radiatorSupport: [{ position: "FRONT", sizes: [120, 140, 240], maxThicknessMm: 25 }],
      fanMounts: [
        { position: "FRONT", size: 120, maxCount: 2 },
        { position: "REAR", size: 120, maxCount: 1 },
      ],
      includedFans: 1,
      driveBays: { m2ViaMobo: true, ssd25: 2, hdd35: 1 },
      frontPanel: [
        { type: "USB3", count: 1 },
        { type: "AUDIO", count: 1 },
      ],
      expansionSlots: 4,
      psuPosition: "BOTTOM",
      dimensionsMm: { l: 400, w: 207, h: 366 },
      weightKg: 4.2,
      sidePanel: "MESH",
    },
  },
  {
    // Compact Mini-ITX case — deliberately can't fit a Micro-ATX board, a
    // 357mm GPU, a 420mm radiator, or an ATX PSU. Used by the mandatory
    // "reference app's invalid build" golden fixture (docs §12).
    partType: "CASE",
    manufacturer: "Cooler Master",
    model: "NR200P",
    performanceTier: 5,
    lengthMm: 376,
    widthMm: 185,
    heightMm: 292,
    specs: {
      formFactor: "SFF",
      supportedMotherboardFormFactors: ["MINI_ITX"],
      maxGpuLengthMm: 330,
      maxGpuHeightMm: 145,
      gpuSlotCount: 2,
      maxCpuCoolerHeightMm: 155,
      maxPsuLengthMm: 130,
      psuFormFactors: ["SFX", "SFX_L"],
      radiatorSupport: [{ position: "FRONT", sizes: [120, 140, 240], maxThicknessMm: 27 }],
      fanMounts: [
        { position: "FRONT", size: 120, maxCount: 2 },
        { position: "TOP", size: 120, maxCount: 2 },
      ],
      includedFans: 2,
      driveBays: { m2ViaMobo: true, ssd25: 2, hdd35: 0 },
      frontPanel: [
        { type: "USB3", count: 1 },
        { type: "USB_C", count: 1 },
        { type: "AUDIO", count: 1 },
      ],
      expansionSlots: 2,
      psuPosition: "CHAMBER",
      dimensionsMm: { l: 376, w: 185, h: 292 },
      weightKg: 5.4,
      sidePanel: "TEMPERED_GLASS",
    },
  },

  // ============================= CPU_COOLER =============================
  {
    partType: "CPU_COOLER",
    manufacturer: "Cooler Master",
    model: "Hyper 212 Black Edition",
    performanceTier: 5,
    heightMm: 159,
    specs: {
      type: "AIR",
      supportedSockets: ["LGA1700", "AM5", "AM4", "LGA1200"],
      heightMm: 159,
      fanCount: 1,
      fanSizeMm: 120,
      tdpRatingWatts: 150,
      ramClearanceMm: 46,
      noiseDb: 26,
      requiresBackplate: true,
    },
  },
  {
    partType: "CPU_COOLER",
    manufacturer: "Corsair",
    model: "iCUE H100i RGB Elite (240mm AIO)",
    performanceTier: 7,
    specs: {
      type: "AIO_LIQUID",
      supportedSockets: ["LGA1700", "AM5", "AM4", "LGA1200"],
      radiatorSizeMm: 240,
      radiatorThicknessMm: 27,
      fanCount: 2,
      fanSizeMm: 120,
      tdpRatingWatts: 250,
      noiseDb: 32,
    },
  },
  {
    // 420mm — no compact case seeded here has a mount for it; see the
    // golden-fixture note on the NR200P case above.
    partType: "CPU_COOLER",
    manufacturer: "Corsair",
    model: "iCUE H170i Elite LCD XT (420mm AIO)",
    performanceTier: 9,
    specs: {
      type: "AIO_LIQUID",
      supportedSockets: ["LGA1700", "AM5", "AM4"],
      radiatorSizeMm: 420,
      radiatorThicknessMm: 30,
      fanCount: 3,
      fanSizeMm: 140,
      tdpRatingWatts: 400,
      noiseDb: 34,
    },
  },
];

export async function seedBuilder() {
  const partsByKey = await seedComponentParts();
  await seedConnectors(partsByKey);
  await seedCompatibilityRules();
  await seedBuildTemplates(partsByKey);
}

function partKey(manufacturer: string, model: string) {
  return `${manufacturer}::${model}`;
}

async function seedComponentParts() {
  const byKey = new Map<string, { id: string }>();

  for (const part of PARTS) {
    let variantId: string | null = null;
    if (part.variantSku) {
      const variant = await db.variant.findUnique({ where: { sku: part.variantSku } });
      variantId = variant?.id ?? null;
    }

    // The one gate every writer of `ComponentPart.specs` must pass through
    // (docs §3) — this both validates the hand-written specs above and
    // fills in every Zod `.default(...)`, so partial literals (like the
    // GPUs' `outputs` arrays skipping `maxDisplays`) still land in the DB
    // fully populated.
    const validatedSpecs = parsePartSpecs(part.partType, part.specs);

    const existing = await db.componentPart.findFirst({
      where: { manufacturer: part.manufacturer, model: part.model },
    });

    const data = {
      variantId,
      partType: part.partType as PartType,
      manufacturer: part.manufacturer,
      model: part.model,
      specs: validatedSpecs as never,
      performanceTier: part.performanceTier,
      tdpWatts: part.tdpWatts,
      idleWatts: part.idleWatts,
      loadWatts: part.loadWatts,
      transientMultiplier: part.transientMultiplier,
      lengthMm: part.lengthMm,
      widthMm: part.widthMm,
      heightMm: part.heightMm,
      // Seeded by hand for this pass, not imported from a vendor feed —
      // VERIFIED is appropriate here (contrast with the WordPress
      // migration path in docs/06 §13.2 step 10, where imported legacy
      // parts must start UNVERIFIED until a human checks them).
      dataSource: "MANUAL" as const,
      dataConfidence: "VERIFIED" as const,
      isActive: true,
    };

    const row = existing
      ? await db.componentPart.update({ where: { id: existing.id }, data })
      : await db.componentPart.create({ data });

    byKey.set(partKey(part.manufacturer, part.model), row);
  }

  return byKey;
}

async function seedConnectors(partsByKey: Map<string, { id: string }>) {
  async function addConnector(
    key: string,
    direction: ConnectorDirection,
    connectorType: ConnectorType,
    quantity: number,
  ) {
    const part = partsByKey.get(key);
    if (!part) throw new Error(`seedConnectors: unknown part ${key}`);
    const existing = await db.partConnector.findFirst({
      where: { partId: part.id, direction, connectorType },
    });
    if (existing) {
      await db.partConnector.update({ where: { id: existing.id }, data: { quantity } });
    } else {
      await db.partConnector.create({
        data: { partId: part.id, direction, connectorType, quantity },
      });
    }
  }

  // Motherboards.
  for (const mobo of [
    partKey("Asus", "Prime B760M-K"),
    partKey("MSI", "PRO B650M-A WiFi"),
    partKey("ASRock", "B550M Pro4"),
  ]) {
    await addConnector(mobo, "REQUIRES", "ATX_24PIN", 1);
    await addConnector(mobo, "REQUIRES", "EPS_8PIN", 1);
    await addConnector(mobo, "PROVIDES", "SATA_DATA", 4);
    await addConnector(mobo, "PROVIDES", "M2_M_KEY", 2);
    await addConnector(mobo, "PROVIDES", "USB2_HEADER", 2);
    await addConnector(mobo, "PROVIDES", "USB3_HEADER", 1);
    await addConnector(mobo, "PROVIDES", "FRONT_PANEL_AUDIO", 1);
    await addConnector(mobo, "PROVIDES", "FAN_4PIN", 4);
    await addConnector(mobo, "PROVIDES", "ARGB_3PIN", 2);
  }

  // PSUs.
  const rm750x = partKey("Corsair", "RM750x");
  await addConnector(rm750x, "PROVIDES", "ATX_24PIN", 1);
  await addConnector(rm750x, "PROVIDES", "EPS_8PIN", 2);
  await addConnector(rm750x, "PROVIDES", "PCIE_8PIN", 4);
  await addConnector(rm750x, "PROVIDES", "SATA_POWER", 6);
  await addConnector(rm750x, "PROVIDES", "MOLEX", 2);

  const cv650 = partKey("Corsair", "CV650");
  await addConnector(cv650, "PROVIDES", "ATX_24PIN", 1);
  await addConnector(cv650, "PROVIDES", "EPS_8PIN", 1);
  await addConnector(cv650, "PROVIDES", "PCIE_8PIN", 2);
  await addConnector(cv650, "PROVIDES", "SATA_POWER", 4);
  await addConnector(cv650, "PROVIDES", "MOLEX", 2);

  // GPUs — the RTX 4070 requires 12VHPWR (covered by the PSUs' 8-pin PCIe
  // via adapter, see `connector-check.ts`); the RTX 5090 requires
  // 12V-2x6, which neither seeded PSU provides or can adapt to, by design
  // (part of the invalid golden fixture's expected shortfall).
  await addConnector(partKey("MSI", "GeForce RTX 4060 Gaming X 8GB"), "REQUIRES", "PCIE_8PIN", 1);
  await addConnector(
    partKey("Asus", "Dual GeForce RTX 4070 OC 12GB"),
    "REQUIRES",
    "PCIE_12VHPWR",
    1,
  );
  await addConnector(partKey("Sapphire", "Pulse Radeon RX 7600 8GB"), "REQUIRES", "PCIE_8PIN", 1);
  await addConnector(partKey("Astral", "RTX 5090 32GB OC"), "REQUIRES", "PCIE_12V2X6", 1);

  // Storage.
  await addConnector(partKey("Samsung", "970 EVO Plus 1TB"), "REQUIRES", "M2_M_KEY", 1);
  await addConnector(partKey("WD", "Black SN770 1TB"), "REQUIRES", "M2_M_KEY", 1);
  await addConnector(partKey("Seagate", "Barracuda 2TB"), "REQUIRES", "SATA_DATA", 1);
  await addConnector(partKey("Seagate", "Barracuda 2TB"), "REQUIRES", "SATA_POWER", 1);

  // Cases.
  for (const kase of [
    partKey("NZXT", "H510"),
    partKey("Cooler Master", "MasterBox Q300L"),
    partKey("Cooler Master", "NR200P"),
  ]) {
    await addConnector(kase, "REQUIRES", "FRONT_PANEL_AUDIO", 1);
    await addConnector(kase, "REQUIRES", "USB3_HEADER", 1);
  }
  await addConnector(partKey("NZXT", "H510"), "REQUIRES", "USB2_HEADER", 1);

  // Coolers.
  const aio240 = partKey("Corsair", "iCUE H100i RGB Elite (240mm AIO)");
  await addConnector(aio240, "REQUIRES", "FAN_4PIN", 1);
  await addConnector(aio240, "REQUIRES", "ARGB_3PIN", 1);

  const aio420 = partKey("Corsair", "iCUE H170i Elite LCD XT (420mm AIO)");
  await addConnector(aio420, "REQUIRES", "FAN_4PIN", 1);
  await addConnector(aio420, "REQUIRES", "ARGB_3PIN", 1);
}

async function seedCompatibilityRules() {
  for (const [index, rule] of RULE_CATALOGUE.entries()) {
    await db.compatibilityRule.upsert({
      where: { code: rule.code },
      create: {
        code: rule.code,
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        subjectType: rule.subjectType,
        objectType: rule.objectType,
        expression: rule.expression as never,
        messageTemplate: rule.messageTemplate,
        fixHintTemplate: rule.fixHintTemplate,
        autoFixStrategy: rule.autoFixStrategy,
        isBlocking: rule.isBlocking,
        isPreventive: rule.isPreventive,
        isActive: true,
        priority: index,
      },
      update: {
        name: rule.name,
        description: rule.description,
        severity: rule.severity,
        expression: rule.expression as never,
        messageTemplate: rule.messageTemplate,
        fixHintTemplate: rule.fixHintTemplate,
        autoFixStrategy: rule.autoFixStrategy,
        isBlocking: rule.isBlocking,
        isPreventive: rule.isPreventive,
        priority: index,
      },
    });
  }
}

interface BuildTemplateInput {
  name: string;
  slug: string;
  useCase: BuildUseCase;
  tier: string;
  budgetBandPaisa: number;
  parts: string[];
}

async function seedBuildTemplates(partsByKey: Map<string, { id: string }>) {
  const templates: BuildTemplateInput[] = [
    {
      name: "Budget Gaming Build",
      slug: "budget-gaming-build",
      useCase: "GAMING",
      tier: "entry",
      budgetBandPaisa: rupeesToPaisa(120_000),
      parts: [
        partKey("AMD", "Ryzen 5 5600"),
        partKey("ASRock", "B550M Pro4"),
        partKey("Corsair", "Vengeance 16GB (2x8GB) DDR4-3200"),
        partKey("Samsung", "970 EVO Plus 1TB"),
        partKey("Sapphire", "Pulse Radeon RX 7600 8GB"),
        partKey("Corsair", "CV650"),
        partKey("Cooler Master", "MasterBox Q300L"),
      ],
    },
    {
      name: "1440p Gaming Build",
      slug: "1440p-gaming-build",
      useCase: "GAMING",
      tier: "mid",
      budgetBandPaisa: rupeesToPaisa(220_000),
      parts: [
        partKey("AMD", "Ryzen 5 7600"),
        partKey("MSI", "PRO B650M-A WiFi"),
        partKey("Kingston", "Fury Beast 32GB (2x16GB) DDR5-5600"),
        partKey("WD", "Black SN770 1TB"),
        partKey("Asus", "Dual GeForce RTX 4070 OC 12GB"),
        partKey("Corsair", "RM750x"),
        partKey("NZXT", "H510"),
        partKey("Cooler Master", "Hyper 212 Black Edition"),
      ],
    },
    {
      name: "Content Creator Workstation",
      slug: "content-creator-workstation",
      useCase: "CONTENT_CREATION",
      tier: "high-end",
      budgetBandPaisa: rupeesToPaisa(280_000),
      parts: [
        partKey("Intel", "Core i7-13700K"),
        partKey("Asus", "Prime B760M-K"),
        partKey("Corsair", "Dominator Platinum 32GB (2x16GB) DDR5-6000"),
        partKey("Samsung", "970 EVO Plus 1TB"),
        partKey("Asus", "Dual GeForce RTX 4070 OC 12GB"),
        partKey("Corsair", "RM750x"),
        partKey("NZXT", "H510"),
        partKey("Corsair", "iCUE H100i RGB Elite (240mm AIO)"),
      ],
    },
  ];

  for (const [index, tmpl] of templates.entries()) {
    const itemsJson = tmpl.parts.map((key, slotIndex) => {
      const part = partsByKey.get(key);
      if (!part) throw new Error(`seedBuildTemplates: unknown part ${key}`);
      return { slotKey: `slot_${slotIndex + 1}`, partId: part.id, quantity: 1 };
    });

    await db.buildTemplate.upsert({
      where: { slug: tmpl.slug },
      create: {
        name: tmpl.name,
        slug: tmpl.slug,
        useCase: tmpl.useCase,
        tier: tmpl.tier,
        budgetBandPaisa: tmpl.budgetBandPaisa,
        itemsJson: itemsJson as never,
        isActive: true,
        position: index,
      },
      update: { itemsJson: itemsJson as never },
    });
  }
}
