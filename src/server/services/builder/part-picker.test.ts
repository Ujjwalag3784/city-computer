import { beforeEach, describe, expect, it, vi } from "vitest";
import { toRuleRecords } from "./rule-catalogue";

/**
 * `listCandidatePartsForSlot` unit tests — mocks `@/server/db` the same way
 * `builds.test.ts` does, and mocks `./rules`'s `loadActiveRules` to return
 * the real seeded rule catalogue (`toRuleRecords()`, same fixture
 * `engine.test.ts` uses) rather than a live DB-backed cache, so these tests
 * exercise the real `CPU_SOCKET_MATCH` rule end-to-end through
 * `evaluateSelectedParts` without needing a database.
 */
vi.mock("./rules", () => ({ loadActiveRules: vi.fn(async () => toRuleRecords()) }));

vi.mock("@/server/db", () => ({
  db: {
    build: { findUnique: vi.fn() },
    componentPart: { findMany: vi.fn() },
  },
}));

const { db } = await import("@/server/db");
const { listCandidatePartsForSlot } = await import("./part-picker");

const CPU_ITEM = {
  slotKey: "cpu",
  quantity: 1,
  isUserSelected: true,
  unitPricePaisaSnapshot: 3200000,
  part: {
    id: "part_cpu_1",
    partType: "CPU",
    manufacturer: "Intel",
    model: "Core i5-13400F",
    specs: {
      socket: "LGA1700",
      tdpWatts: 65,
      maxTurboPowerWatts: 148,
      supportedRamTypes: ["DDR4", "DDR5"],
      // `present: true` (unlike the plain `CPU_LGA1700` fixture in
      // engine.test.ts) so these tests, which never add a GPU, don't also
      // trip the unrelated `GPU_REQUIRED` rule — that rule is real and
      // correct (see rule-catalogue.ts), it's just not what these
      // candidate-listing tests are exercising.
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
    connectors: [],
  },
};

function motherboardCandidate(id: string, socket: "LGA1700" | "AM5", model: string) {
  return {
    id,
    partType: "MOTHERBOARD",
    manufacturer: "Test",
    model,
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
    dataConfidence: "VERIFIED" as const,
    variantId: null,
    connectors: [],
    variant: null,
  };
}

beforeEach(() => {
  vi.mocked(db.build.findUnique).mockReset();
  vi.mocked(db.componentPart.findMany).mockReset();
});

describe("listCandidatePartsForSlot", () => {
  it("marks a socket-matching motherboard as compatible", async () => {
    vi.mocked(db.build.findUnique).mockResolvedValue({
      id: "build_1",
      useCase: "GAMING",
      targetResolution: "FHD",
      budgetPaisa: null,
      items: [CPU_ITEM],
    } as never);
    vi.mocked(db.componentPart.findMany).mockResolvedValue([
      motherboardCandidate("part_mobo_match", "LGA1700", "Prime B760M-K"),
    ] as never);

    const rows = await listCandidatePartsForSlot("build_1", "motherboard");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.compatible).toBe(true);
    expect(rows[0]?.incompatibleReason).toBeUndefined();
  });

  it("marks a socket-mismatched motherboard as incompatible with a real reason", async () => {
    vi.mocked(db.build.findUnique).mockResolvedValue({
      id: "build_1",
      useCase: "GAMING",
      targetResolution: "FHD",
      budgetPaisa: null,
      items: [CPU_ITEM],
    } as never);
    vi.mocked(db.componentPart.findMany).mockResolvedValue([
      motherboardCandidate("part_mobo_mismatch", "AM5", "PRO B650M-A WiFi"),
    ] as never);

    const rows = await listCandidatePartsForSlot("build_1", "motherboard");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.compatible).toBe(false);
    expect(rows[0]?.incompatibleReason).toBeTruthy();
    expect(rows[0]?.incompatibleReason).toMatch(/socket/i);
    expect(rows[0]?.incompatibleReason).not.toMatch(/CPU_MOBO_SOCKET/);
  });

  it("evaluates the slot's current occupant against the rest of the build, not against itself twice", async () => {
    // The CPU's own slot is being re-picked — its own current selection
    // must still appear in the candidate list (never silently excluded)
    // and must read as compatible with the (otherwise-empty) rest of the
    // build once substituted back into its own slot.
    vi.mocked(db.build.findUnique).mockResolvedValue({
      id: "build_1",
      useCase: "GAMING",
      targetResolution: "FHD",
      budgetPaisa: null,
      items: [CPU_ITEM],
    } as never);
    vi.mocked(db.componentPart.findMany).mockResolvedValue([
      {
        id: CPU_ITEM.part.id,
        partType: "CPU",
        manufacturer: CPU_ITEM.part.manufacturer,
        model: CPU_ITEM.part.model,
        specs: CPU_ITEM.part.specs,
        performanceTier: CPU_ITEM.part.performanceTier,
        benchmarkScore: null,
        tdpWatts: CPU_ITEM.part.tdpWatts,
        idleWatts: null,
        loadWatts: null,
        transientMultiplier: null,
        lengthMm: null,
        widthMm: null,
        heightMm: null,
        dataConfidence: "VERIFIED",
        variantId: null,
        connectors: [],
        variant: null,
      },
    ] as never);

    const rows = await listCandidatePartsForSlot("build_1", "cpu");

    expect(rows).toHaveLength(1);
    expect(rows[0]?.partId).toBe(CPU_ITEM.part.id);
    expect(rows[0]?.compatible).toBe(true);
  });

  it("throws for an unknown slot key", async () => {
    vi.mocked(db.build.findUnique).mockResolvedValue({
      id: "build_1",
      useCase: "GAMING",
      targetResolution: "FHD",
      budgetPaisa: null,
      items: [],
    } as never);

    await expect(listCandidatePartsForSlot("build_1", "not_a_real_slot")).rejects.toThrow();
  });
});
