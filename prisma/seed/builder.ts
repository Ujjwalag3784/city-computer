/**
 * DEV-ONLY SEED DATA — reduced from the blueprint's suggested 60 builder
 * parts (docs/06-DATA-MODEL.md §13.3) to ~22 to keep this initial seed
 * reviewable. Extend before Phase 4 QA / before the compatibility engine
 * gets real behavioural tests against a wide part catalogue.
 *
 * Covers CPU, GPU, MOTHERBOARD, RAM, STORAGE, PSU, CASE, CPU_COOLER —
 * every partType the task asked for. PartConnector rows are seeded for a
 * representative subset (one motherboard, one PSU, all GPUs, all storage
 * parts, one case, one cooler) rather than every part, matching the
 * "handful, not exhaustive" scope given for this pass. CompatibilityRule
 * seeds the five rules explicitly called out as the minimum set.
 *
 * Four parts are deliberately the *same physical product* as a catalog.ts
 * demo product (Intel i5-13400F, MSI RTX 4060, the Corsair RAM kit, the
 * Samsung SSD) and are linked via ComponentPart.variantId, showing the
 * builder <-> catalogue link actually working end to end. Every other part
 * here is informational-only (variantId null), which is a legitimate
 * state per docs/06 §7 ("not every part must be a variant").
 */
import { db } from "@/server/db";
import { rupeesToPaisa } from "@/lib/money";
import type {
  PartType,
  ConnectorType,
  ConnectorDirection,
  BuildUseCase,
} from "@/generated/prisma/client";

interface PartInput {
  variantSku?: string;
  partType: PartType;
  manufacturer: string;
  model: string;
  specs: Record<string, unknown>;
  performanceTier: number;
  tdpWatts?: number;
  loadWatts?: number;
  lengthMm?: number;
  widthMm?: number;
  heightMm?: number;
}

const PARTS: PartInput[] = [
  // ---- CPU ------------------------------------------------------------
  {
    variantSku: "INTEL-I5-13400F",
    partType: "CPU",
    manufacturer: "Intel",
    model: "Core i5-13400F",
    specs: { socket: "LGA1700", cores: 10, threads: 16, integratedGraphics: false },
    performanceTier: 6,
    tdpWatts: 65,
    loadWatts: 148,
  },
  {
    partType: "CPU",
    manufacturer: "Intel",
    model: "Core i7-13700K",
    specs: { socket: "LGA1700", cores: 16, threads: 24, integratedGraphics: true },
    performanceTier: 9,
    tdpWatts: 125,
    loadWatts: 253,
  },
  {
    partType: "CPU",
    manufacturer: "AMD",
    model: "Ryzen 5 7600",
    specs: { socket: "AM5", cores: 6, threads: 12, integratedGraphics: true },
    performanceTier: 7,
    tdpWatts: 65,
    loadWatts: 88,
  },
  {
    partType: "CPU",
    manufacturer: "AMD",
    model: "Ryzen 5 5600",
    specs: { socket: "AM4", cores: 6, threads: 12, integratedGraphics: false },
    performanceTier: 5,
    tdpWatts: 65,
    loadWatts: 76,
  },

  // ---- GPU --------------------------------------------------------------
  {
    variantSku: "MSI-RTX4060-GAMX",
    partType: "GPU",
    manufacturer: "MSI",
    model: "GeForce RTX 4060 Gaming X 8GB",
    specs: { chipset: "RTX 4060", memoryGb: 8, memoryType: "GDDR6" },
    performanceTier: 6,
    loadWatts: 115,
    lengthMm: 245,
  },
  {
    partType: "GPU",
    manufacturer: "Asus",
    model: "Dual GeForce RTX 4070 OC 12GB",
    specs: { chipset: "RTX 4070", memoryGb: 12, memoryType: "GDDR6X" },
    performanceTier: 8,
    loadWatts: 200,
    lengthMm: 267,
  },
  {
    partType: "GPU",
    manufacturer: "Sapphire",
    model: "Pulse Radeon RX 7600 8GB",
    specs: { chipset: "RX 7600", memoryGb: 8, memoryType: "GDDR6" },
    performanceTier: 5,
    loadWatts: 165,
    lengthMm: 225,
  },

  // ---- MOTHERBOARD --------------------------------------------------------
  {
    partType: "MOTHERBOARD",
    manufacturer: "Asus",
    model: "Prime B760M-K",
    specs: { socket: "LGA1700", chipset: "B760", formFactor: "Micro-ATX", memoryType: ["DDR4"] },
    performanceTier: 5,
  },
  {
    partType: "MOTHERBOARD",
    manufacturer: "MSI",
    model: "PRO B650M-A WiFi",
    specs: { socket: "AM5", chipset: "B650", formFactor: "Micro-ATX", memoryType: ["DDR5"] },
    performanceTier: 6,
  },
  {
    partType: "MOTHERBOARD",
    manufacturer: "ASRock",
    model: "B550M Pro4",
    specs: { socket: "AM4", chipset: "B550", formFactor: "Micro-ATX", memoryType: ["DDR4"] },
    performanceTier: 4,
  },

  // ---- RAM --------------------------------------------------------------
  {
    variantSku: "CORSAIR-VNG-16GB-3200",
    partType: "RAM",
    manufacturer: "Corsair",
    model: "Vengeance 16GB (2x8GB) DDR4-3200",
    specs: { memoryType: "DDR4", capacityGb: 16, speedMhz: 3200, stickCount: 2 },
    performanceTier: 5,
  },
  {
    partType: "RAM",
    manufacturer: "Kingston",
    model: "Fury Beast 32GB (2x16GB) DDR5-5600",
    specs: { memoryType: "DDR5", capacityGb: 32, speedMhz: 5600, stickCount: 2 },
    performanceTier: 7,
  },
  {
    partType: "RAM",
    manufacturer: "Corsair",
    model: "Dominator Platinum 32GB (2x16GB) DDR5-6000",
    specs: { memoryType: "DDR5", capacityGb: 32, speedMhz: 6000, stickCount: 2 },
    performanceTier: 8,
  },

  // ---- STORAGE ------------------------------------------------------------
  {
    variantSku: "SAMSUNG-970EVOP-1TB",
    partType: "STORAGE",
    manufacturer: "Samsung",
    model: "970 EVO Plus 1TB",
    specs: { storageType: "NVMe SSD", capacityGb: 1000, interface: "PCIe 3.0" },
    performanceTier: 6,
  },
  {
    partType: "STORAGE",
    manufacturer: "WD",
    model: "Black SN770 1TB",
    specs: { storageType: "NVMe SSD", capacityGb: 1000, interface: "PCIe 4.0" },
    performanceTier: 7,
  },
  {
    partType: "STORAGE",
    manufacturer: "Seagate",
    model: "Barracuda 2TB",
    specs: { storageType: "HDD", capacityGb: 2000, interface: "SATA III" },
    performanceTier: 2,
  },

  // ---- PSU --------------------------------------------------------------
  {
    partType: "PSU",
    manufacturer: "Corsair",
    model: "RM750x",
    specs: { wattage: 750, efficiencyRating: "80+ Gold", modular: "Full-modular" },
    performanceTier: 7,
  },
  {
    partType: "PSU",
    manufacturer: "Corsair",
    model: "CV650",
    specs: { wattage: 650, efficiencyRating: "80+ Bronze", modular: "Non-modular" },
    performanceTier: 4,
  },

  // ---- CASE --------------------------------------------------------------
  {
    partType: "CASE",
    manufacturer: "NZXT",
    model: "H510",
    specs: { formFactor: "Mid Tower", supportedMotherboardSizes: ["ATX", "Micro-ATX", "Mini-ITX"] },
    performanceTier: 5,
    lengthMm: 435,
    widthMm: 210,
    heightMm: 460,
  },
  {
    partType: "CASE",
    manufacturer: "Cooler Master",
    model: "MasterBox Q300L",
    specs: { formFactor: "Mini Tower", supportedMotherboardSizes: ["Micro-ATX", "Mini-ITX"] },
    performanceTier: 4,
    lengthMm: 400,
    widthMm: 207,
    heightMm: 366,
  },

  // ---- CPU_COOLER --------------------------------------------------------
  {
    partType: "CPU_COOLER",
    manufacturer: "Cooler Master",
    model: "Hyper 212 Black Edition",
    specs: { coolerType: "Air", supportedSockets: ["LGA1700", "AM5", "AM4"] },
    performanceTier: 5,
    heightMm: 159,
  },
  {
    partType: "CPU_COOLER",
    manufacturer: "Corsair",
    model: "iCUE H100i RGB Elite (240mm AIO)",
    specs: {
      coolerType: "AIO Liquid",
      supportedSockets: ["LGA1700", "AM5", "AM4"],
      radiatorSizeMm: 240,
    },
    performanceTier: 7,
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

    const existing = await db.componentPart.findFirst({
      where: { manufacturer: part.manufacturer, model: part.model },
    });

    const data = {
      variantId,
      partType: part.partType,
      manufacturer: part.manufacturer,
      model: part.model,
      specs: part.specs as never,
      performanceTier: part.performanceTier,
      tdpWatts: part.tdpWatts,
      loadWatts: part.loadWatts,
      lengthMm: part.lengthMm,
      widthMm: part.widthMm,
      heightMm: part.heightMm,
      // Seeded by hand for this first pass, not imported from a vendor
      // feed — VERIFIED is appropriate here (contrast with the WordPress
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

  // One representative motherboard.
  const mobo = partKey("Asus", "Prime B760M-K");
  await addConnector(mobo, "REQUIRES", "ATX_24PIN", 1);
  await addConnector(mobo, "REQUIRES", "EPS_8PIN", 1);
  await addConnector(mobo, "PROVIDES", "SATA_DATA", 4);
  await addConnector(mobo, "PROVIDES", "M2_M_KEY", 2);
  await addConnector(mobo, "PROVIDES", "USB2_HEADER", 2);
  await addConnector(mobo, "PROVIDES", "USB3_HEADER", 1);
  await addConnector(mobo, "PROVIDES", "FRONT_PANEL_AUDIO", 1);
  await addConnector(mobo, "PROVIDES", "FAN_4PIN", 4);
  await addConnector(mobo, "PROVIDES", "ARGB_3PIN", 2);

  // One representative PSU.
  const psu = partKey("Corsair", "RM750x");
  await addConnector(psu, "PROVIDES", "ATX_24PIN", 1);
  await addConnector(psu, "PROVIDES", "EPS_8PIN", 2);
  await addConnector(psu, "PROVIDES", "PCIE_8PIN", 4);
  await addConnector(psu, "PROVIDES", "SATA_POWER", 6);
  await addConnector(psu, "PROVIDES", "MOLEX", 2);

  // All three GPUs.
  await addConnector(partKey("MSI", "GeForce RTX 4060 Gaming X 8GB"), "REQUIRES", "PCIE_8PIN", 1);
  await addConnector(partKey("Asus", "Dual GeForce RTX 4070 OC 12GB"), "REQUIRES", "PCIE_8PIN", 2);
  await addConnector(partKey("Sapphire", "Pulse Radeon RX 7600 8GB"), "REQUIRES", "PCIE_8PIN", 1);

  // All storage parts.
  await addConnector(partKey("Samsung", "970 EVO Plus 1TB"), "REQUIRES", "M2_M_KEY", 1);
  await addConnector(partKey("WD", "Black SN770 1TB"), "REQUIRES", "M2_M_KEY", 1);
  await addConnector(partKey("Seagate", "Barracuda 2TB"), "REQUIRES", "SATA_DATA", 1);
  await addConnector(partKey("Seagate", "Barracuda 2TB"), "REQUIRES", "SATA_POWER", 1);

  // One representative case.
  const kase = partKey("NZXT", "H510");
  await addConnector(kase, "REQUIRES", "FRONT_PANEL_AUDIO", 1);
  await addConnector(kase, "REQUIRES", "USB3_HEADER", 1);
  await addConnector(kase, "REQUIRES", "USB2_HEADER", 1);

  // One representative cooler (the AIO).
  const cooler = partKey("Corsair", "iCUE H100i RGB Elite (240mm AIO)");
  await addConnector(cooler, "REQUIRES", "FAN_4PIN", 1);
  await addConnector(cooler, "REQUIRES", "ARGB_3PIN", 1);
}

interface RuleInput {
  code: string;
  name: string;
  description: string;
  severity: "ERROR" | "WARNING" | "INFO";
  subjectType: PartInput["partType"];
  objectType: PartInput["partType"];
  expression: Record<string, unknown>;
  messageTemplate: string;
  fixHintTemplate: string;
  isBlocking: boolean;
}

// The five rules explicitly called out as the minimum set.
const RULES: RuleInput[] = [
  {
    code: "CPU_SOCKET_MATCH",
    name: "Processor and motherboard socket must match",
    description: "The CPU's socket must be identical to the motherboard's socket.",
    severity: "ERROR",
    subjectType: "CPU",
    objectType: "MOTHERBOARD",
    expression: { op: "eq", left: "subject.specs.socket", right: "object.specs.socket" },
    messageTemplate:
      "{{subject.model}} uses a {{subject.specs.socket}} socket, but {{object.model}} is {{object.specs.socket}}.",
    fixHintTemplate:
      "Choose a motherboard with a {{subject.specs.socket}} socket, or a different processor.",
    isBlocking: true,
  },
  {
    code: "RAM_TYPE_MATCH",
    name: "Memory type must match the motherboard",
    description: "RAM must be the same generation (DDR4/DDR5) the motherboard supports.",
    severity: "ERROR",
    subjectType: "RAM",
    objectType: "MOTHERBOARD",
    expression: { op: "in", left: "subject.specs.memoryType", right: "object.specs.memoryType" },
    messageTemplate:
      "{{subject.model}} is {{subject.specs.memoryType}}, but {{object.model}} only supports {{object.specs.memoryType}}.",
    fixHintTemplate: "Choose memory of the type your motherboard supports.",
    isBlocking: true,
  },
  {
    code: "PSU_WATTAGE_SUFFICIENT",
    name: "Power supply must be strong enough for the whole build",
    description:
      "The PSU's wattage must be at least the build's estimated total power draw plus a safety margin. This is a build-level check — both subjectType and objectType are PSU because the real comparison is against the aggregate load of every other selected part, not a single other part; the engine reads the whole build's estimated wattage, not object.specs.",
    severity: "ERROR",
    subjectType: "PSU",
    objectType: "PSU",
    expression: { op: "gte", left: "subject.specs.wattage", right: "build.estimatedWatts * 1.2" },
    messageTemplate:
      "Your power supply is {{subject.specs.wattage}}W, but this build needs about {{build.recommendedPsuWatts}}W.",
    fixHintTemplate: "Choose a power supply rated at least {{build.recommendedPsuWatts}}W.",
    isBlocking: true,
  },
  {
    code: "GPU_LENGTH_FITS_CASE",
    name: "Graphics card must fit in the case",
    description:
      "The GPU's length must not exceed the case's maximum supported graphics card length.",
    severity: "ERROR",
    subjectType: "GPU",
    objectType: "CASE",
    expression: { op: "lte", left: "subject.lengthMm", right: "object.specs.maxGpuLengthMm" },
    messageTemplate:
      "{{subject.model}} is {{subject.lengthMm}}mm long, longer than {{object.model}}'s {{object.specs.maxGpuLengthMm}}mm limit.",
    fixHintTemplate: "Choose a shorter graphics card, or a larger case.",
    isBlocking: true,
  },
  {
    code: "CASE_FORM_FACTOR_MATCH",
    name: "Motherboard size must fit the case",
    description: "The motherboard's form factor must be one the case explicitly supports.",
    severity: "ERROR",
    subjectType: "MOTHERBOARD",
    objectType: "CASE",
    expression: {
      op: "in",
      left: "subject.specs.formFactor",
      right: "object.specs.supportedMotherboardSizes",
    },
    messageTemplate:
      "{{subject.model}} is {{subject.specs.formFactor}}, which {{object.model}} does not list as supported.",
    fixHintTemplate: "Choose a case that supports {{subject.specs.formFactor}} motherboards.",
    isBlocking: true,
  },
];

async function seedCompatibilityRules() {
  for (const [index, rule] of RULES.entries()) {
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
        autoFixStrategy: "NONE",
        isBlocking: rule.isBlocking,
        isPreventive: true,
        isActive: true,
        priority: index,
      },
      update: {
        name: rule.name,
        description: rule.description,
        expression: rule.expression as never,
        messageTemplate: rule.messageTemplate,
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
      useCase: "GAMING" as const,
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
      useCase: "CONTENT_CREATION" as const,
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
