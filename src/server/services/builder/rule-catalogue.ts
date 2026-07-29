/**
 * The rule catalogue — docs/08-PC-BUILDER-ENGINE.md §4.2's table of 50
 * named compatibility checks. This module is the single source of truth
 * both the DB seed (`prisma/seed/builder.ts`) and the golden-build tests
 * import from, so the rules a fresh dev database gets and the rules the
 * test suite asserts against can never drift apart.
 *
 * Every rule's `expression` states the condition that must hold for the
 * subject/object pair to be *compatible* — `rule-engine.ts` fires an
 * issue when the expression evaluates to `false` (see that file's own
 * header for why).
 *
 * HONEST COVERAGE NOTE — not all 50 named checks from §4.2 become a
 * `CompatibilityRule` row here, because several of them are architecturally
 * a different pass, not a subject/object rule:
 *
 * - Implemented as `CompatibilityRule` rows below: 38 of the 50.
 * - SUBSUMED by the generic connector-satisfaction pass (`connector-check.ts`
 *   + `validate-build.ts`'s own `connectorShortfalls`, not a rule row —
 *   docs §4.3's own framing is "a single generic check, not one rule per
 *   connector type"): `GPU_PSU_CONNECTORS`, `STORAGE_PSU_SATA_POWER`,
 *   `PSU_EPS_CONNECTORS`, `CASE_FRONT_PANEL_HEADERS`, `COOLER_FAN_HEADERS`.
 *   All five are real, enforced checks — they just fire from the
 *   `PartConnector` REQUIRES/PROVIDES sums rather than from a row here.
 * - COMPUTED DIRECTLY in `validate-build.ts` rather than as a rule row:
 *   `BUILD_UNVERIFIED_DATA` (spans every `PartType`, not one subject/object
 *   pair — see that file's own comment).
 * - DEFERRED (flagged, not faked — no rule row, no synthetic stand-in):
 *   `STORAGE_LANE_SHARING` and `STORAGE_PCIE_GEN` (both need tracking which
 *   *specific* M.2 slot a drive occupies, which this pass's slot model
 *   doesn't capture — `storage_1..4` are generic slots, not bound to a
 *   motherboard's individual M.2 connectors); `GPU_MONITOR_PORTS` (needs
 *   array-of-object port-type intersection between GPU outputs and
 *   monitor inputs, which `MONITOR` is explicitly out of scope for this
 *   pass per `part-specs.ts`'s own header); `COOLER_RADIATOR_GPU_CONFLICT`
 *   (needs knowing which case position — front/top/rear — the user
 *   mounted the radiator at, which isn't captured anywhere in the data
 *   model); `BUILD_STOCK_UNAVAILABLE` and `BUILD_PRICE_CHANGED` (both need
 *   a live `ProductVariant` stock/price lookup per build item, which this
 *   validation pass doesn't make — it only reads `ComponentPart` and the
 *   `Build`'s own saved snapshot).
 *
 * One further simplification worth flagging: `CPU_MOBO_SUPPORTED_LIST`'s
 * docs severity is dynamic ("W, downgraded to I if `biosFlashback` is
 * true") — `CompatibilityRule.severity` is one fixed value per row, and
 * the message-template interpolator (`rule-engine.ts`'s `renderTemplate`)
 * only substitutes values, it doesn't branch on them — so this pass keeps
 * the rule at a flat `WARNING` with a static fix-hint that tells the
 * shopper to check for BIOS Flashback themselves, rather than building
 * per-row dynamic severity and conditional message text (a real but
 * narrow feature left for later).
 */
import type { BoolNode, ValueNode } from "./rule-expression";
import type { PartType, RuleSeverity, AutoFixStrategy } from "@/generated/prisma/client";
import type { CompatibilityRuleRecord } from "./rules";

export interface RuleCatalogueEntry {
  code: string;
  name: string;
  description: string;
  severity: RuleSeverity;
  subjectType: PartType;
  objectType: PartType;
  expression: BoolNode;
  messageTemplate: string;
  fixHintTemplate: string;
  autoFixStrategy: AutoFixStrategy;
  isBlocking: boolean;
  isPreventive: boolean;
}

// ---- Tiny expression builders (readability only — no behavior of their own) ----

const ref = (path: string): ValueNode => ({ ref: path });
const lit = (value: unknown): ValueNode => ({ literal: value });
const eq = (left: ValueNode, right: ValueNode): BoolNode => ({ op: "EQ", left, right });
const gte = (left: ValueNode, right: ValueNode): BoolNode => ({ op: "GTE", left, right });
const lte = (left: ValueNode, right: ValueNode): BoolNode => ({ op: "LTE", left, right });
const lt = (left: ValueNode, right: ValueNode): BoolNode => ({ op: "LT", left, right });
const contains = (left: ValueNode, right: ValueNode): BoolNode => ({ op: "CONTAINS", left, right });
const notIn = (left: ValueNode, right: ValueNode): BoolNode => ({ op: "NOT_IN", left, right });
const and = (...clauses: BoolNode[]): BoolNode => ({ op: "AND", clauses });
const or = (...clauses: BoolNode[]): BoolNode => ({ op: "OR", clauses });
const not = (clause: BoolNode): BoolNode => ({ op: "NOT", clause });
const exists = (refPath: string): BoolNode => ({ op: "EXISTS", ref: refPath });
const missing = (refPath: string): BoolNode => not(exists(refPath));
/** "If the referenced value is absent, treat the pair as compatible" — the recurring pattern for optional spec fields the seed data may not always populate. */
const ifPresent = (refPath: string, clause: BoolNode): BoolNode => or(missing(refPath), clause);
const countOf = (collection: ValueNode, where?: BoolNode): ValueNode => ({
  op: "COUNT_OF",
  collection,
  where,
});
const sumOf = (collection: ValueNode, field: string): ValueNode => ({
  op: "SUM_OF",
  collection,
  field,
});
const add = (...args: ValueNode[]): ValueNode => ({ op: "ADD", args });
const multiply = (...args: ValueNode[]): ValueNode => ({ op: "MULTIPLY", args });

export const RULE_CATALOGUE: RuleCatalogueEntry[] = [
  // ============================= CPU <-> MOTHERBOARD =============================
  {
    code: "CPU_MOBO_SOCKET",
    name: "Processor and motherboard socket must match",
    description: "The CPU's socket must be identical to the motherboard's socket.",
    severity: "ERROR",
    subjectType: "CPU",
    objectType: "MOTHERBOARD",
    expression: eq(ref("subject.specs.socket"), ref("object.specs.socket")),
    messageTemplate:
      "{{subject.model}} uses a {{subject.specs.socket}} socket, but {{object.model}} is {{object.specs.socket}}.",
    fixHintTemplate:
      "Choose a motherboard with a {{subject.specs.socket}} socket, or a different processor.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "CPU_MOBO_SUPPORTED_LIST",
    name: "Processor should be on the motherboard's supported CPU list",
    description:
      "When a board publishes a supported-CPU list, a CPU outside it usually needs a BIOS update first.",
    severity: "WARNING",
    subjectType: "CPU",
    objectType: "MOTHERBOARD",
    expression: ifPresent(
      "object.specs.supportedCpuList",
      contains(ref("object.specs.supportedCpuList"), ref("subject.model")),
    ),
    messageTemplate:
      "{{object.model}}'s published CPU support list doesn't include {{subject.model}} — it may need a BIOS update first.",
    fixHintTemplate:
      "Check {{object.model}}'s QVL, or ask the seller whether it ships with BIOS Flashback / a current BIOS.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "CPU_MOBO_RAM_TYPE",
    name: "Processor must support the motherboard's memory type",
    description: "The CPU's supported RAM types must include the board's memory type.",
    severity: "ERROR",
    subjectType: "CPU",
    objectType: "MOTHERBOARD",
    expression: contains(ref("subject.specs.supportedRamTypes"), ref("object.specs.ramType")),
    messageTemplate:
      "{{subject.model}} doesn't support {{object.specs.ramType}} memory, which {{object.model}} uses.",
    fixHintTemplate: "Choose a motherboard/CPU pair that agree on memory type.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "CPU_MOBO_VRM",
    name: "Motherboard VRM should be rated for the processor's TDP",
    description:
      "A board's recommended max CPU TDP is a thermal/VRM ceiling, not a hard block, but exceeding it under sustained load can throttle or trip protection.",
    severity: "WARNING",
    subjectType: "CPU",
    objectType: "MOTHERBOARD",
    expression: ifPresent(
      "object.specs.maxCpuTdpRecommendedWatts",
      lte(ref("subject.specs.tdpWatts"), ref("object.specs.maxCpuTdpRecommendedWatts")),
    ),
    messageTemplate:
      "{{object.model}}'s VRM is rated for up to {{object.specs.maxCpuTdpRecommendedWatts}}W, but {{subject.model}} is a {{subject.specs.tdpWatts}}W part.",
    fixHintTemplate: "Choose a board with a stronger VRM, or a lower-TDP processor.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "CPU_MOBO_PCIE_GEN",
    name: "CPU and motherboard PCIe generation",
    description:
      "When the CPU's PCIe generation differs from the board's primary slot, the link trains down to the lower generation — informational, not a blocker.",
    severity: "INFO",
    subjectType: "CPU",
    objectType: "MOTHERBOARD",
    expression: ifPresent(
      "subject.specs.pcieVersion",
      ifPresent(
        "object.specs.pcieSlots.0.version",
        eq(ref("subject.specs.pcieVersion"), ref("object.specs.pcieSlots.0.version")),
      ),
    ),
    messageTemplate:
      "{{subject.model}} is PCIe {{subject.specs.pcieVersion}}, while {{object.model}}'s primary slot is PCIe {{object.specs.pcieSlots.0.version}} — the link will run at the lower generation.",
    fixHintTemplate:
      "This doesn't block the build; only matters if you need the full bandwidth of the faster generation.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },

  // ============================= RAM <-> MOTHERBOARD / CPU =============================
  {
    code: "RAM_MOBO_TYPE",
    name: "Memory type must match the motherboard",
    description: "RAM must be the same generation (DDR4/DDR5) the motherboard supports.",
    severity: "ERROR",
    subjectType: "RAM",
    objectType: "MOTHERBOARD",
    expression: eq(ref("subject.specs.type"), ref("object.specs.ramType")),
    messageTemplate:
      "{{subject.model}} is {{subject.specs.type}}, but {{object.model}} only supports {{object.specs.ramType}}.",
    fixHintTemplate: "Choose memory of the type your motherboard supports.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "RAM_MOBO_SLOTS",
    name: "RAM stick count must fit the motherboard's DIMM slots",
    description: "The kit's stick count must not exceed the board's RAM slots.",
    severity: "ERROR",
    subjectType: "RAM",
    objectType: "MOTHERBOARD",
    expression: lte(ref("subject.specs.stickCount"), ref("object.specs.ramSlots")),
    messageTemplate:
      "{{subject.model}} has {{subject.specs.stickCount}} sticks, but {{object.model}} only has {{object.specs.ramSlots}} DIMM slots.",
    fixHintTemplate: "Choose a kit with fewer sticks, or a board with more DIMM slots.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "RAM_MOBO_CAPACITY",
    name: "Total RAM capacity must fit the motherboard's limit",
    description:
      "The kit's total capacity must not exceed the board's maximum supported RAM capacity.",
    severity: "ERROR",
    subjectType: "RAM",
    objectType: "MOTHERBOARD",
    expression: lte(ref("subject.specs.totalCapacityGb"), ref("object.specs.maxRamCapacityGb")),
    messageTemplate:
      "{{subject.model}} is {{subject.specs.totalCapacityGb}}GB total, more than {{object.model}}'s {{object.specs.maxRamCapacityGb}}GB limit.",
    fixHintTemplate: "Choose a smaller kit, or a board with a higher RAM capacity limit.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "RAM_MOBO_SPEED",
    name: "RAM speed vs motherboard maximum",
    description:
      "RAM rated faster than the board's maximum will simply run at the board's max instead.",
    severity: "INFO",
    subjectType: "RAM",
    objectType: "MOTHERBOARD",
    expression: lte(ref("subject.specs.speedMhz"), ref("object.specs.maxRamSpeedMhz")),
    messageTemplate:
      "{{subject.model}} is rated {{subject.specs.speedMhz}}MHz, but {{object.model}} tops out at {{object.specs.maxRamSpeedMhz}}MHz — it'll run at the lower speed.",
    fixHintTemplate: "Still works — only matters if you specifically want the full rated speed.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "RAM_CPU_SPEED",
    name: "RAM speed vs processor's memory controller maximum",
    description: "RAM rated faster than the CPU's supported max will run at the CPU's max instead.",
    severity: "INFO",
    subjectType: "RAM",
    objectType: "CPU",
    expression: ifPresent(
      "object.specs.maxRamSpeedMhz",
      lte(ref("subject.specs.speedMhz"), ref("object.specs.maxRamSpeedMhz")),
    ),
    messageTemplate:
      "{{subject.model}} is rated {{subject.specs.speedMhz}}MHz, faster than {{object.model}}'s supported {{object.specs.maxRamSpeedMhz}}MHz.",
    fixHintTemplate: "Still works — only matters if you specifically want the full rated speed.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "RAM_XMP_REQUIRED",
    name: "XMP/EXPO profile must be enabled to reach the rated speed",
    description:
      "A kit sold with an XMP or EXPO profile only reaches its advertised speed once that profile is enabled in the BIOS — otherwise it runs at plain JEDEC speed.",
    severity: "INFO",
    subjectType: "RAM",
    objectType: "RAM",
    expression: eq(ref("subject.specs.profileType"), lit("JEDEC")),
    messageTemplate:
      "{{subject.model}} needs its {{subject.specs.profileType}} profile enabled in the BIOS to run at its rated {{subject.specs.speedMhz}}MHz.",
    fixHintTemplate:
      "Enable XMP/EXPO (sometimes called DOCP) in the motherboard's BIOS after building.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "RAM_CHANNEL_SUBOPTIMAL",
    name: "Odd stick count runs single-channel",
    description:
      "One stick (or three, on a dual-channel platform) leaves memory bandwidth on the table compared to a matched pair.",
    severity: "WARNING",
    subjectType: "RAM",
    objectType: "RAM",
    expression: notIn(ref("subject.specs.stickCount"), lit([1, 3])),
    messageTemplate:
      "{{subject.model}} has {{subject.specs.stickCount}} sticks — an even number (2 or 4) runs faster dual-channel memory.",
    fixHintTemplate:
      "Choose a 2-stick or 4-stick kit of the same total capacity for full dual-channel bandwidth.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "RAM_COOLER_CLEARANCE",
    name: "RAM height must clear the CPU cooler",
    description: "Tall RAM heatspreaders can physically collide with a low-hanging air cooler.",
    severity: "ERROR",
    subjectType: "RAM",
    objectType: "CPU_COOLER",
    expression: ifPresent(
      "object.specs.ramClearanceMm",
      lte(ref("subject.specs.heightMm"), ref("object.specs.ramClearanceMm")),
    ),
    messageTemplate:
      "{{subject.model}} is {{subject.specs.heightMm}}mm tall, taller than {{object.model}}'s {{object.specs.ramClearanceMm}}mm memory clearance.",
    fixHintTemplate: "Choose low-profile RAM, or a cooler with more memory clearance.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },

  // ============================= GPU =============================
  {
    code: "GPU_REQUIRED",
    name: "A graphics card is required without integrated graphics",
    description:
      "If the CPU has no integrated GPU, the build needs a discrete graphics card to produce any video output at all.",
    severity: "ERROR",
    subjectType: "CPU",
    objectType: "CPU",
    expression: or(
      eq(ref("subject.specs.integratedGraphics.present"), lit(true)),
      eq(ref("build.hasGpu"), lit(true)),
    ),
    messageTemplate:
      "{{subject.model}} has no integrated graphics, so this build needs a graphics card to display anything.",
    fixHintTemplate: "Add a graphics card, or choose a CPU with integrated graphics.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: false,
  },
  {
    code: "GPU_MOBO_SLOT",
    name: "Motherboard must have a free x16 slot for the graphics card",
    description: "The board needs at least one physical x16 PCIe slot for the GPU.",
    severity: "ERROR",
    subjectType: "GPU",
    objectType: "MOTHERBOARD",
    expression: gte(
      countOf(ref("object.specs.pcieSlots"), eq(ref("item.physicalSize"), lit("x16"))),
      lit(1),
    ),
    messageTemplate: "{{object.model}} has no x16 PCIe slot for {{subject.model}}.",
    fixHintTemplate: "Choose a motherboard with a physical x16 PCIe slot.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "GPU_CASE_LENGTH",
    name: "Graphics card must fit the case's max GPU length",
    description:
      "The GPU's length must not exceed the case's maximum supported graphics card length.",
    severity: "ERROR",
    subjectType: "GPU",
    objectType: "CASE",
    expression: lte(ref("subject.specs.lengthMm"), ref("object.specs.maxGpuLengthMm")),
    messageTemplate:
      "{{subject.model}} is {{subject.specs.lengthMm}}mm long, longer than {{object.model}}'s {{object.specs.maxGpuLengthMm}}mm limit.",
    fixHintTemplate: "Choose a shorter graphics card, or a larger case.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "GPU_CASE_SLOTS",
    name: "Graphics card thickness must fit the case's slot count",
    description:
      "A thick (multi-slot) GPU must not exceed the case's expansion slot count at the GPU's position.",
    severity: "ERROR",
    subjectType: "GPU",
    objectType: "CASE",
    expression: lte(ref("subject.specs.thicknessSlots"), ref("object.specs.gpuSlotCount")),
    messageTemplate:
      "{{subject.model}} is {{subject.specs.thicknessSlots}} slots thick, more than {{object.model}}'s {{object.specs.gpuSlotCount}} GPU slots.",
    fixHintTemplate: "Choose a thinner graphics card, or a case with more expansion slots.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "GPU_CASE_HEIGHT",
    name: "Graphics card height vs case side-panel clearance",
    description:
      "A very tall GPU cooler shroud can occasionally interfere with a case's side panel.",
    severity: "WARNING",
    subjectType: "GPU",
    objectType: "CASE",
    expression: ifPresent(
      "object.specs.maxGpuHeightMm",
      ifPresent(
        "subject.specs.heightMm",
        lte(ref("subject.specs.heightMm"), ref("object.specs.maxGpuHeightMm")),
      ),
    ),
    messageTemplate:
      "{{subject.model}} is {{subject.specs.heightMm}}mm tall, taller than {{object.model}}'s {{object.specs.maxGpuHeightMm}}mm side-panel clearance.",
    fixHintTemplate: "Check the case's side panel clearance, or choose a slimmer card.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "GPU_PCIE_GEN",
    name: "GPU and motherboard PCIe generation",
    description:
      "When the GPU's PCIe generation differs from the board's primary slot, the link trains down — informational, not a blocker.",
    severity: "INFO",
    subjectType: "GPU",
    objectType: "MOTHERBOARD",
    expression: ifPresent(
      "subject.specs.pcieVersion",
      ifPresent(
        "object.specs.pcieSlots.0.version",
        eq(ref("subject.specs.pcieVersion"), ref("object.specs.pcieSlots.0.version")),
      ),
    ),
    messageTemplate:
      "{{subject.model}} is PCIe {{subject.specs.pcieVersion}}, while {{object.model}}'s primary slot is PCIe {{object.specs.pcieSlots.0.version}}.",
    fixHintTemplate:
      "This doesn't block the build; only matters for the very top end of bandwidth-bound workloads.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "BUILD_USE_CASE_MISMATCH",
    name: "Graphics card should suit the build's stated use case",
    description:
      "Flags a GPU that's a clear mismatch for the build's declared use case or target resolution (e.g. under-12GB VRAM for AI/ML, or a low-tier card for 4K gaming).",
    severity: "WARNING",
    subjectType: "GPU",
    objectType: "GPU",
    expression: not(
      or(
        and(eq(ref("context.useCase"), lit("AI_ML")), lt(ref("subject.specs.vramGb"), lit(12))),
        and(
          eq(ref("context.targetResolution"), lit("UHD")),
          lte(ref("subject.performanceTier"), lit(4)),
        ),
      ),
    ),
    messageTemplate:
      "{{subject.model}} may be underpowered for a {{context.useCase}} build targeting {{context.targetResolution}}.",
    fixHintTemplate:
      "Consider a card with more VRAM (for AI/ML work) or a higher performance tier (for 4K gaming).",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: false,
    isPreventive: false,
  },

  // ============================= STORAGE =============================
  {
    code: "STORAGE_SATA_PORTS",
    name: "SATA drive count must fit the motherboard's SATA ports",
    description: "The build's total SATA drives must not exceed the board's SATA ports.",
    severity: "ERROR",
    subjectType: "MOTHERBOARD",
    objectType: "MOTHERBOARD",
    expression: lte(ref("build.sataInterfaceDriveCount"), ref("subject.specs.sataPorts")),
    messageTemplate:
      "This build has {{build.sataInterfaceDriveCount}} SATA drives, but {{subject.model}} only has {{subject.specs.sataPorts}} SATA ports.",
    fixHintTemplate:
      "Remove a SATA drive, switch one to M.2 NVMe, or choose a board with more SATA ports.",
    autoFixStrategy: "NONE",
    isBlocking: true,
    isPreventive: false,
  },
  {
    code: "STORAGE_CASE_BAYS",
    name: '2.5"/3.5" drive count must fit the case\'s drive bays',
    description:
      "SATA SSDs and hard drives need a physical bay in the case; M.2 drives mount on the motherboard and don't count against this.",
    severity: "ERROR",
    subjectType: "CASE",
    objectType: "CASE",
    expression: lte(
      add(ref("build.sataDriveCount"), ref("build.hddCount")),
      add(ref("subject.specs.driveBays.ssd25"), ref("subject.specs.driveBays.hdd35")),
    ),
    messageTemplate:
      'This build has {{build.sataDriveCount}} 2.5" and {{build.hddCount}} 3.5" drives, more than {{subject.model}}\'s drive bays.',
    fixHintTemplate:
      "Remove a drive, switch one to M.2 NVMe, or choose a case with more drive bays.",
    autoFixStrategy: "NONE",
    isBlocking: true,
    isPreventive: false,
  },

  // ============================= COOLING =============================
  {
    code: "COOLER_SOCKET",
    name: "CPU cooler must support the processor's socket",
    description: "The cooler's supported-sockets list must include the CPU's socket.",
    severity: "ERROR",
    subjectType: "CPU_COOLER",
    objectType: "CPU",
    expression: contains(ref("subject.specs.supportedSockets"), ref("object.specs.socket")),
    messageTemplate:
      "{{subject.model}} doesn't list {{object.specs.socket}} as a supported socket, but {{object.model}} uses {{object.specs.socket}}.",
    fixHintTemplate:
      "Choose a cooler that supports {{object.specs.socket}} (check for an included or purchasable mounting bracket).",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "COOLER_TDP",
    name: "CPU cooler should be rated for the processor's peak power",
    description:
      "A cooler rated below the CPU's peak turbo power will struggle to hold boost clocks under sustained load.",
    severity: "WARNING",
    subjectType: "CPU_COOLER",
    objectType: "CPU",
    expression: ifPresent(
      "object.specs.maxTurboPowerWatts",
      gte(ref("subject.specs.tdpRatingWatts"), ref("object.specs.maxTurboPowerWatts")),
    ),
    messageTemplate:
      "{{subject.model}} is rated for {{subject.specs.tdpRatingWatts}}W, below {{object.model}}'s {{object.specs.maxTurboPowerWatts}}W peak draw.",
    fixHintTemplate:
      "Choose a cooler with a higher TDP rating, or expect some thermal throttling under sustained load.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "COOLER_CASE_HEIGHT",
    name: "Air cooler height must fit the case",
    description:
      "An air tower cooler's height must not exceed the case's maximum CPU cooler height.",
    severity: "ERROR",
    subjectType: "CPU_COOLER",
    objectType: "CASE",
    expression: or(
      not(eq(ref("subject.specs.type"), lit("AIR"))),
      ifPresent(
        "subject.specs.heightMm",
        lte(ref("subject.specs.heightMm"), ref("object.specs.maxCpuCoolerHeightMm")),
      ),
    ),
    messageTemplate:
      "{{subject.model}} is {{subject.specs.heightMm}}mm tall, taller than {{object.model}}'s {{object.specs.maxCpuCoolerHeightMm}}mm cooler clearance.",
    fixHintTemplate:
      "Choose a shorter air cooler, an AIO instead, or a case with more cooler clearance.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "COOLER_RADIATOR_FIT",
    name: "AIO radiator must fit one of the case's radiator mounts",
    description:
      "The reference app most conspicuously lacks this check: a case must have a radiator mount (top/front/etc.) whose size list includes the AIO's radiator size and whose max thickness fits it.",
    severity: "ERROR",
    subjectType: "CPU_COOLER",
    objectType: "CASE",
    expression: or(
      not(eq(ref("subject.specs.type"), lit("AIO_LIQUID"))),
      gte(
        countOf(
          ref("object.specs.radiatorSupport"),
          and(
            contains(ref("item.sizes"), ref("subject.specs.radiatorSizeMm")),
            gte(ref("item.maxThicknessMm"), ref("subject.specs.radiatorThicknessMm")),
          ),
        ),
        lit(1),
      ),
    ),
    messageTemplate:
      "{{object.model}} has no radiator mount that fits {{subject.model}}'s {{subject.specs.radiatorSizeMm}}mm radiator.",
    fixHintTemplate:
      "Choose a case with a matching radiator mount, or a smaller AIO / air cooler instead.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "COOLER_REQUIRED",
    name: "A CPU cooler is required unless the stock cooler is adequate",
    description:
      "If no cooler is selected, the CPU's included stock cooler (if any) must be rated for the CPU's own TDP.",
    severity: "WARNING",
    subjectType: "CPU",
    objectType: "CPU",
    expression: or(
      eq(ref("build.hasCooler"), lit(true)),
      and(
        eq(ref("subject.specs.includedCooler.present"), lit(true)),
        lte(
          ref("subject.specs.tdpWatts"),
          ref("subject.specs.includedCooler.adequateUpToTdpWatts"),
        ),
      ),
    ),
    messageTemplate:
      "{{subject.model}} doesn't ship a cooler adequate for its own {{subject.specs.tdpWatts}}W, and no cooler is selected yet.",
    fixHintTemplate: "Add a CPU cooler to this build.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: false,
    isPreventive: false,
  },

  // ============================= CASE / PSU =============================
  {
    code: "CASE_MOBO_FORM_FACTOR",
    name: "Motherboard form factor must fit the case",
    description: "The motherboard's form factor must be one the case explicitly supports.",
    severity: "ERROR",
    subjectType: "MOTHERBOARD",
    objectType: "CASE",
    expression: contains(
      ref("object.specs.supportedMotherboardFormFactors"),
      ref("subject.specs.formFactor"),
    ),
    messageTemplate:
      "{{subject.model}} is {{subject.specs.formFactor}}, which {{object.model}} does not list as supported.",
    fixHintTemplate: "Choose a case that supports {{subject.specs.formFactor}} motherboards.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "CASE_PSU_FORM_FACTOR",
    name: "PSU form factor must fit the case",
    description: "The power supply's form factor (ATX/SFX/...) must be one the case supports.",
    severity: "ERROR",
    subjectType: "PSU",
    objectType: "CASE",
    expression: contains(ref("object.specs.psuFormFactors"), ref("subject.specs.formFactor")),
    messageTemplate:
      "{{subject.model}} is {{subject.specs.formFactor}}, which {{object.model}} does not list as supported.",
    fixHintTemplate: "Choose a PSU form factor the case supports.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "CASE_PSU_LENGTH",
    name: "PSU length must fit the case's PSU bay",
    description: "A long ATX PSU can be too deep for a compact case's PSU shroud.",
    severity: "ERROR",
    subjectType: "PSU",
    objectType: "CASE",
    expression: ifPresent(
      "object.specs.maxPsuLengthMm",
      ifPresent(
        "subject.specs.lengthMm",
        lte(ref("subject.specs.lengthMm"), ref("object.specs.maxPsuLengthMm")),
      ),
    ),
    messageTemplate:
      "{{subject.model}} is {{subject.specs.lengthMm}}mm long, longer than {{object.model}}'s {{object.specs.maxPsuLengthMm}}mm PSU bay.",
    fixHintTemplate: "Choose a shorter PSU, or a case with a deeper PSU bay.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: true,
  },
  {
    code: "CASE_FAN_COUNT",
    name: "Selected fans must fit the case's fan mounts",
    description:
      "The build's total selected fans (case fans + any AIO fans) must not exceed what the case's fan mounts can hold.",
    severity: "INFO",
    subjectType: "CASE",
    objectType: "CASE",
    expression: lte(ref("build.totalFanCount"), sumOf(ref("subject.specs.fanMounts"), "maxCount")),
    messageTemplate:
      "This build has {{build.totalFanCount}} fans, more than {{subject.model}}'s fan mounts can hold.",
    fixHintTemplate: "Remove a fan, or choose a case with more fan mounts.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "PSU_TOTAL_POWER",
    name: "Power supply must cover the build's peak load",
    description:
      "The PSU's rated wattage must be at least the build's transient peak load — see the power model (docs §5) for how peak load is derived. This also covers what docs §4.2 separately lists as GPU_PSU_WATTAGE; both are the same underlying wattage check.",
    severity: "ERROR",
    subjectType: "PSU",
    objectType: "PSU",
    expression: gte(ref("subject.specs.wattage"), ref("build.peakLoadWatts")),
    messageTemplate:
      "{{subject.model}} is {{subject.specs.wattage}}W, but this build's peak load is about {{build.peakLoadWatts}}W (recommended: {{build.recommendedPsuWatts}}W).",
    fixHintTemplate: "Choose a power supply rated at least {{build.recommendedPsuWatts}}W.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: true,
    isPreventive: false,
  },
  {
    code: "PSU_QUALITY",
    name: "PSU quality tier should match a high-end graphics card",
    description:
      "A budget-tier PSU powering a high-end GPU is a common source of instability under transient load spikes.",
    severity: "WARNING",
    subjectType: "PSU",
    objectType: "GPU",
    expression: not(
      and(
        eq(ref("subject.specs.qualityTier"), lit("BUDGET")),
        gte(ref("object.performanceTier"), lit(8)),
      ),
    ),
    messageTemplate:
      "{{subject.model}} is a budget-tier PSU paired with {{object.model}}, a high-end card — transient power spikes can cause instability.",
    fixHintTemplate:
      "Choose a PSU with at least a STANDARD or GOOD quality tier for a card this powerful.",
    autoFixStrategy: "SUGGEST_ALTERNATIVE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "PSU_EFFICIENCY_LOAD",
    name: "PSU load should sit in its efficient range",
    description:
      "A PSU run under 20% or over 80% of its rated wattage is outside its most efficient (and often quietest) operating range.",
    severity: "INFO",
    subjectType: "PSU",
    objectType: "PSU",
    expression: and(
      gte(ref("build.baseLoadWatts"), multiply(ref("subject.specs.wattage"), lit(0.2))),
      lte(ref("build.baseLoadWatts"), multiply(ref("subject.specs.wattage"), lit(0.8))),
    ),
    messageTemplate:
      "This build's typical draw is about {{build.baseLoadWatts}}W against a {{subject.specs.wattage}}W PSU — outside the 20-80% efficient range.",
    fixHintTemplate:
      "Not a problem in itself — only relevant if you care about maximizing PSU efficiency/noise.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },

  // ============================= CROSS-BUILD =============================
  {
    code: "BUILD_BOTTLENECK",
    name: "CPU/GPU balance",
    description:
      "See the balance/bottleneck model (docs §6) — flags a build whose CPU and GPU are meaningfully mismatched for its target resolution.",
    severity: "WARNING",
    subjectType: "CPU",
    objectType: "CPU",
    expression: eq(ref("build.balanceVerdict"), lit("BALANCED")),
    messageTemplate:
      "This build's balance is {{build.balanceVerdict}} at {{context.targetResolution}}.",
    fixHintTemplate:
      "A stronger or weaker CPU/GPU can bring this back into balance — see the balance meter for which side to adjust.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "BUILD_BUDGET_EXCEEDED",
    name: "Build total vs stated budget",
    description: "Flags when the running total exceeds the budget the user set for this build.",
    severity: "INFO",
    subjectType: "CPU",
    objectType: "CPU",
    expression: or(
      missing("context.budgetPaisa"),
      lte(ref("build.totalPaisa"), ref("context.budgetPaisa")),
    ),
    messageTemplate: "This build's total is over the budget you set.",
    fixHintTemplate: "Swap a part for a cheaper alternative, or raise the budget.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },
  {
    code: "BUILD_UPGRADE_HEADROOM",
    name: "Remaining upgrade headroom",
    description:
      "Framed positively (docs §4.2) — surfaces free DIMM/M.2 slots as a build strength rather than an issue.",
    severity: "INFO",
    subjectType: "MOTHERBOARD",
    objectType: "MOTHERBOARD",
    expression: not(
      or(gte(ref("build.freeRamSlots"), lit(1)), gte(ref("build.freeM2Slots"), lit(1))),
    ),
    messageTemplate:
      "This build has {{build.freeRamSlots}} free RAM slot(s) and {{build.freeM2Slots}} free M.2 slot(s) for future upgrades.",
    fixHintTemplate: "Nothing to fix — this is a positive note about upgrade room.",
    autoFixStrategy: "NONE",
    isBlocking: false,
    isPreventive: false,
  },
];

/**
 * Maps the catalogue to the shape `rule-engine.ts`'s `evaluateRules`
 * expects (`CompatibilityRuleRecord`, `rules.ts`'s DB-row shape) without
 * touching the database — used by the golden-build tests, and available
 * to a future in-memory "rule tester" admin screen that wants to preview
 * a change to a rule before saving it.
 */
export function toRuleRecords(): CompatibilityRuleRecord[] {
  return RULE_CATALOGUE.map((rule, index) => ({
    id: rule.code,
    code: rule.code,
    name: rule.name,
    severity: rule.severity,
    subjectType: rule.subjectType,
    objectType: rule.objectType,
    expression: rule.expression,
    messageTemplate: rule.messageTemplate,
    fixHintTemplate: rule.fixHintTemplate,
    autoFixStrategy: rule.autoFixStrategy,
    isBlocking: rule.isBlocking,
    isPreventive: rule.isPreventive,
    priority: index,
  }));
}
