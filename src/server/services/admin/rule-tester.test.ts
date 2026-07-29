import { beforeEach, describe, expect, it, vi } from "vitest";
import { toRuleRecords } from "@/server/services/builder/rule-catalogue";

/**
 * `runRuleTester`/`listRuleTesterPartOptions` unit tests — same mocking
 * approach as `builder/part-picker.test.ts`: mock `@/server/db` and
 * `builder/rules`'s `loadActiveRules` to return the real seeded rule
 * catalogue fixture, so these tests exercise the real `CPU_SOCKET_MATCH`
 * rule end-to-end through `evaluateSelectedParts` without needing a
 * database.
 */
vi.mock("@/server/services/builder/rules", () => ({
  loadActiveRules: vi.fn(async () => toRuleRecords()),
}));

vi.mock("@/server/db", () => ({
  db: {
    componentPart: { findMany: vi.fn() },
  },
}));

const { db } = await import("@/server/db");
const { runRuleTester, listRuleTesterPartOptions } = await import("./rule-tester");

function cpuRow(id: string) {
  return {
    id,
    partType: "CPU",
    manufacturer: "Intel",
    model: "Core i5-13400F",
    specs: {
      socket: "LGA1700",
      tdpWatts: 65,
      maxTurboPowerWatts: 148,
      supportedRamTypes: ["DDR4", "DDR5"],
      integratedGraphics: { present: true },
      includedCooler: { present: false },
    },
    performanceTier: 6,
    benchmarkScore: null,
    tdpWatts: 65,
    idleWatts: null,
    loadWatts: null,
    transientMultiplier: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    dataConfidence: "VERIFIED",
    isActive: true,
    connectors: [],
  };
}

function motherboardRow(id: string, socket: "LGA1700" | "AM5") {
  return {
    id,
    partType: "MOTHERBOARD",
    manufacturer: "Test",
    model: `Board-${socket}`,
    specs: {
      socket,
      formFactor: "MICRO_ATX",
      ramType: socket === "LGA1700" ? "DDR4" : "DDR5",
      ramSlots: 4,
      maxRamCapacityGb: 128,
      maxRamSpeedMhz: 5333,
      maxCpuTdpRecommendedWatts: 125,
      pcieSlots: [{ version: 4, lanes: 16, physicalSize: "x16", position: 0, isFromCpu: true }],
      m2Slots: [{ key: "M", maxLengthMm: 2280, supportsSata: false }],
      sataPorts: 4,
    },
    performanceTier: 5,
    benchmarkScore: null,
    tdpWatts: null,
    idleWatts: null,
    loadWatts: null,
    transientMultiplier: null,
    lengthMm: null,
    widthMm: null,
    heightMm: null,
    dataConfidence: "VERIFIED",
    isActive: true,
    connectors: [],
  };
}

beforeEach(() => {
  vi.mocked(db.componentPart.findMany).mockReset();
});

describe("runRuleTester", () => {
  it("reports no fired ERROR issues for a socket-matching CPU + motherboard pair", async () => {
    vi.mocked(db.componentPart.findMany).mockResolvedValue([
      cpuRow("part_cpu"),
      motherboardRow("part_mobo", "LGA1700"),
    ] as never);

    const report = await runRuleTester({ cpu: "part_cpu", motherboard: "part_mobo" });

    expect(report.errorCount).toBe(0);
    expect(report.issues.some((issue) => issue.severity === "ERROR")).toBe(false);
  });

  it("fires CPU_SOCKET_MATCH for a mismatched CPU + motherboard pair, naming both slots", async () => {
    vi.mocked(db.componentPart.findMany).mockResolvedValue([
      cpuRow("part_cpu"),
      motherboardRow("part_mobo", "AM5"),
    ] as never);

    const report = await runRuleTester({ cpu: "part_cpu", motherboard: "part_mobo" });

    const socketIssue = report.issues.find((issue) => issue.ruleCode === "CPU_MOBO_SOCKET");
    expect(socketIssue).toBeDefined();
    expect(socketIssue?.severity).toBe("ERROR");
    expect(socketIssue?.subjectSlotKey).toBe("cpu");
    expect(socketIssue?.objectSlotKey).toBe("motherboard");
  });

  it("ignores slots with no selection rather than erroring", async () => {
    vi.mocked(db.componentPart.findMany).mockResolvedValue([cpuRow("part_cpu")] as never);

    const report = await runRuleTester({ cpu: "part_cpu" });

    expect(report.errorCount).toBe(0);
  });
});

describe("listRuleTesterPartOptions", () => {
  it("groups active parts by slot, keyed by every core SLOT_MODEL slot", async () => {
    const impl = (async (args: { where?: { partType?: string } }) => {
      if (args.where?.partType === "CPU") {
        return [{ id: "part_cpu", manufacturer: "Intel", model: "i5" }];
      }
      return [];
    }) as never;
    vi.mocked(db.componentPart.findMany).mockImplementation(impl);

    const options = await listRuleTesterPartOptions();

    expect(Object.keys(options)).toEqual([
      "cpu",
      "motherboard",
      "ram",
      "gpu",
      "storage_1",
      "cpu_cooler",
      "psu",
      "case",
    ]);
    expect(options.cpu).toHaveLength(1);
    expect(options.motherboard).toHaveLength(0);
  });
});
