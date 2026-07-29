/**
 * The builder's slot model — docs/08-PC-BUILDER-ENGINE.md §2 "Slot model"
 * defines a much larger set of slots (`cpu`, `motherboard`, `ram`, `gpu`,
 * `storage_1..4`, `psu`, `case`, `cpu_cooler`, `case_fan_1..6`,
 * `monitor_1..3`, `os`, `expansion_1..3`, `peripherals`, `thermal_paste`).
 *
 * FLAGGED SIMPLIFICATION (Phase 8 UI pass): this file only models the 8
 * "core" slots a build cannot meaningfully validate without:
 *
 *   cpu, motherboard, ram, gpu, storage_1, cpu_cooler, psu, case
 *
 * Deliberately NOT included here (deferred, not silently dropped — see
 * PROGRESS.md): `case_fan_1..6`, `monitor_1..3`, `os`, `expansion_1..3`,
 * `peripherals`, `thermal_paste`, `storage_2..4`. Rules/models targeting
 * those `PartType`s (e.g. multi-drive storage rules) still evaluate
 * correctly if such a `BuildItem` exists in the DB — this list only drives
 * what the *builder workspace UI* renders as a pickable tile, it does not
 * limit what `validate-build.ts`'s engine can process.
 *
 * FLAGGED SIMPLIFICATION (prerequisite model): docs §2 implies a fuller
 * per-slot prerequisite chain (e.g. a case might reasonably gate case fans,
 * a motherboard might gate RAM's channel count guidance, etc). This file
 * instead uses a single "CPU is the one anchor part" rule: every slot
 * except `cpu` itself lists `cpu` as its prerequisite, and nothing else.
 * This is simpler than the docs' fuller vision but still satisfies §9's
 * "a slot blocked by a missing prerequisite shows 'Pick a processor first'"
 * requirement for the one case that matters most (an empty build).
 */
import type { PartType } from "@/generated/prisma/client";

export interface BuilderSlotDefinition {
  slotKey: string;
  partType: PartType;
  /** Human label, lowercase, suitable for "Pick a {label}" / "Choose a {label}" copy. */
  label: string;
  required: boolean;
  /** Only `cpu` has none — see the header comment's "CPU is the anchor part" note. */
  prerequisiteSlotKey?: string;
}

export const SLOT_MODEL: BuilderSlotDefinition[] = [
  { slotKey: "cpu", partType: "CPU", label: "processor", required: true },
  {
    slotKey: "motherboard",
    partType: "MOTHERBOARD",
    label: "motherboard",
    required: true,
    prerequisiteSlotKey: "cpu",
  },
  {
    slotKey: "ram",
    partType: "RAM",
    label: "memory",
    required: true,
    prerequisiteSlotKey: "cpu",
  },
  {
    slotKey: "gpu",
    partType: "GPU",
    label: "graphics card",
    required: false,
    prerequisiteSlotKey: "cpu",
  },
  {
    slotKey: "storage_1",
    partType: "STORAGE",
    label: "storage drive",
    required: true,
    prerequisiteSlotKey: "cpu",
  },
  {
    slotKey: "cpu_cooler",
    partType: "CPU_COOLER",
    label: "CPU cooler",
    required: false,
    prerequisiteSlotKey: "cpu",
  },
  {
    slotKey: "psu",
    partType: "PSU",
    label: "power supply",
    required: true,
    prerequisiteSlotKey: "cpu",
  },
  {
    slotKey: "case",
    partType: "CASE",
    label: "case",
    required: true,
    prerequisiteSlotKey: "cpu",
  },
];

export function findSlotDefinition(slotKey: string): BuilderSlotDefinition | undefined {
  return SLOT_MODEL.find((slot) => slot.slotKey === slotKey);
}

export function slotLabel(slotKey: string): string {
  return findSlotDefinition(slotKey)?.label ?? slotKey.replace(/_/g, " ");
}
