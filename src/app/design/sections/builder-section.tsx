"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ModeSelect, type BuilderMode } from "@/components/builder/mode-select";
import { StepRail, type BuilderStepInfo } from "@/components/builder/step-rail";
import { MobileStepBar } from "@/components/builder/mobile-step-bar";
import { BuilderSlotCard } from "@/components/builder/builder-slot-card";
import { PartRow, type PartRowData } from "@/components/builder/part-row";
import { PartPickerDrawer } from "@/components/builder/part-picker-drawer";
import { FixDrawer } from "@/components/builder/fix-drawer";
import { PowerMeter } from "@/components/builder/power-meter";
import { BalanceMeter } from "@/components/builder/balance-meter";
import { IssueRow, type IssueSeverity } from "@/components/builder/issue-row";
import { CompatibilityPanel } from "@/components/builder/compatibility-panel";
import { BuildSummaryPanel } from "@/components/builder/build-summary-panel";
import { BuildShareDialog } from "@/components/builder/build-share-dialog";
import { BuildCompare, type CompareBuild } from "@/components/builder/build-compare";
import { UpgradeSuggestionCard } from "@/components/builder/upgrade-suggestion-card";
import { ExpertTipCard } from "@/components/builder/expert-tip-card";

/**
 * BuilderSection — internal `/design` showcase of every component in
 * `src/components/builder/`, per docs/05-DESIGN-SYSTEM.md §10 (showcase
 * routes render every component with representative fake data so every
 * documented state is visible for review in one place).
 */

const STEP_LABELS = [
  "Purpose",
  "Budget",
  "Core",
  "Memory",
  "Graphics",
  "Storage",
  "Power",
  "Cooling",
  "Case",
  "Review",
] as const;

function buildSteps(currentIndex: number): BuilderStepInfo[] {
  return STEP_LABELS.map((label, index): BuilderStepInfo => {
    const status: BuilderStepInfo["status"] =
      index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming";
    return { label, status, isReachable: index <= currentIndex };
  });
}

const cpuPart: PartRowData = {
  id: "part-cpu-ryzen5-7600",
  imageUrl: "https://placehold.co/112x112?text=CPU",
  imageAlt: "AMD Ryzen 5 7600 boxed processor",
  name: "AMD Ryzen 5 7600",
  specs: ["6 cores", "AM5", "65W"],
  price: 2890000,
  stockStatus: "in-stock",
  compatible: true,
};

const cpuPartAlt: PartRowData = {
  id: "part-cpu-ryzen7-7700",
  imageUrl: "https://placehold.co/112x112?text=CPU",
  imageAlt: "AMD Ryzen 7 7700 boxed processor",
  name: "AMD Ryzen 7 7700",
  specs: ["8 cores", "AM5", "65W"],
  price: 3690000,
  stockStatus: "in-stock",
  compatible: true,
};

const cpuPartIncompatible: PartRowData = {
  id: "part-cpu-i5-13400f",
  imageUrl: "https://placehold.co/112x112?text=CPU",
  imageAlt: "Intel Core i5-13400F boxed processor",
  name: "Intel Core i5-13400F",
  specs: ["10 cores", "LGA1700", "65W"],
  price: 2590000,
  stockStatus: "in-stock",
  compatible: false,
  incompatibleReason: "Needs an LGA1700 motherboard — yours is AM5.",
};

const gpuPartIncompatible: PartRowData = {
  id: "part-gpu-rtx-4070ti",
  imageUrl: "https://placehold.co/112x112?text=GPU",
  imageAlt: "NVIDIA GeForce RTX 4070 Ti graphics card",
  name: "NVIDIA GeForce RTX 4070 Ti",
  specs: ["12GB GDDR6X", "PCIe 4.0", "285W"],
  price: 8990000,
  stockStatus: "in-stock",
  compatible: false,
  incompatibleReason: "358mm long — too long for your selected case (max 340mm).",
};

const ramPartDeltaUp: PartRowData = {
  id: "part-ram-32gb-6000",
  imageUrl: "https://placehold.co/112x112?text=RAM",
  imageAlt: "32GB DDR5-6000 memory kit",
  name: "Corsair Vengeance 32GB DDR5-6000",
  specs: ["2x16GB", "DDR5", "6000MHz"],
  price: 1590000,
  stockStatus: "in-stock",
  compatible: true,
  priceDeltaPaisa: 450000,
};

const ramPartDeltaDown: PartRowData = {
  id: "part-ram-16gb-5600",
  imageUrl: "https://placehold.co/112x112?text=RAM",
  imageAlt: "16GB DDR5-5600 memory kit",
  name: "Corsair Vengeance 16GB DDR5-5600",
  specs: ["2x8GB", "DDR5", "5600MHz"],
  price: 690000,
  stockStatus: "in-stock",
  compatible: true,
  priceDeltaPaisa: -120000,
};

const cpuCandidates: PartRowData[] = [cpuPart, cpuPartAlt, cpuPartIncompatible];

const gpuFixCandidates: PartRowData[] = [
  {
    id: "fix-gpu-rtx-4060",
    imageUrl: "https://placehold.co/112x112?text=GPU",
    imageAlt: "NVIDIA GeForce RTX 4060 8GB graphics card",
    name: "NVIDIA GeForce RTX 4060 8GB",
    specs: ["8GB GDDR6", "PCIe 4.0", "115W"],
    price: 4290000,
    stockStatus: "low-stock",
    compatible: true,
    priceDeltaPaisa: -470000,
  },
  {
    id: "fix-gpu-rtx-4060ti",
    imageUrl: "https://placehold.co/112x112?text=GPU",
    imageAlt: "NVIDIA GeForce RTX 4060 Ti 16GB graphics card",
    name: "NVIDIA GeForce RTX 4060 Ti 16GB",
    specs: ["16GB GDDR6", "PCIe 4.0", "165W"],
    price: 5490000,
    stockStatus: "in-stock",
    compatible: true,
    priceDeltaPaisa: -350000,
  },
  {
    id: "fix-gpu-rx-7600",
    imageUrl: "https://placehold.co/112x112?text=GPU",
    imageAlt: "AMD Radeon RX 7600 8GB graphics card",
    name: "AMD Radeon RX 7600 8GB",
    specs: ["8GB GDDR6", "PCIe 4.0", "165W"],
    price: 3790000,
    stockStatus: "in-stock",
    compatible: true,
    priceDeltaPaisa: -650000,
  },
];

const compareBuilds: CompareBuild[] = [
  {
    id: "build-1",
    label: "Gaming build #1",
    totalPrice: 12500000,
    keyParts: [
      { slotLabel: "CPU", partName: "AMD Ryzen 5 7600" },
      { slotLabel: "GPU", partName: "RTX 4060 8GB" },
      { slotLabel: "RAM", partName: "32GB DDR5-6000" },
      { slotLabel: "Storage", partName: "1TB NVMe SSD" },
    ],
    estimatedFpsRange: "90–110 FPS at 1440p",
  },
  {
    id: "build-2",
    label: "Streaming build",
    totalPrice: 15800000,
    keyParts: [
      { slotLabel: "CPU", partName: "AMD Ryzen 7 7700" },
      { slotLabel: "GPU", partName: "RTX 4070 Ti" },
      { slotLabel: "RAM", partName: "32GB DDR5-6000" },
      { slotLabel: "Cooler", partName: "240mm AIO" },
    ],
    estimatedFpsRange: "120–140 FPS at 1440p",
  },
  {
    id: "build-3",
    label: "Budget build",
    totalPrice: 7200000,
    keyParts: [
      { slotLabel: "CPU", partName: "AMD Ryzen 5 5600" },
      { slotLabel: "GPU", partName: "RX 7600 8GB" },
      { slotLabel: "RAM", partName: "16GB DDR4-3200" },
    ],
  },
];

const ISSUE_SEVERITIES: { severity: IssueSeverity; message: string }[] = [
  {
    severity: "error",
    message: "Your graphics card draws more power than your selected PSU can safely deliver.",
  },
  {
    severity: "warning",
    message: "Your processor may hold back this graphics card at 1080p.",
  },
  {
    severity: "info",
    message: "You have a free M.2 slot — room to add more storage later.",
  },
];

export function BuilderSection() {
  const [mode, setMode] = useState<BuilderMode>("standard");
  const [stepIndex, setStepIndex] = useState(2);
  const steps = buildSteps(stepIndex);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [fixOpen, setFixOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <section className="flex flex-col gap-12">
      <div className="flex flex-col gap-6">
        <h2 className="text-headline-md text-on-surface">Mode &amp; navigation</h2>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">ModeSelect</h3>
          <ModeSelect value={mode} onChange={setMode} className="max-w-md" />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">StepRail</h3>
          <div className="rounded-lg border border-glass-stroke p-4">
            <StepRail steps={steps} onStepClick={(index) => setStepIndex(index)} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">MobileStepBar</h3>
          <div className="rounded-lg border border-glass-stroke p-4">
            <MobileStepBar
              steps={steps}
              currentIndex={stepIndex}
              onPrevious={() => setStepIndex((index) => Math.max(0, index - 1))}
              onNext={() => setStepIndex((index) => Math.min(steps.length - 1, index + 1))}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <h2 className="text-headline-md text-on-surface">Slots &amp; parts</h2>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">
            BuilderSlotCard — all five states
          </h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <BuilderSlotCard
              slotLabel="CPU"
              state="filled"
              part={cpuPart}
              onPick={() => setPickerOpen(true)}
              onRemove={() => {}}
            />
            <BuilderSlotCard
              slotLabel="Power supply"
              state="empty-required"
              onPick={() => setPickerOpen(true)}
            />
            <BuilderSlotCard
              slotLabel="Case fan"
              state="empty-optional"
              onPick={() => setPickerOpen(true)}
            />
            <BuilderSlotCard
              slotLabel="Memory"
              state="incompatible"
              prerequisiteLabel="motherboard"
              onPick={() => setPickerOpen(true)}
            />
            <BuilderSlotCard
              slotLabel="CPU cooler"
              state="recommended"
              onPick={() => setPickerOpen(true)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">
            PartRow — compatible, incompatible, selected, and price-delta variants
          </h3>
          <div className="flex flex-col gap-2">
            <PartRow part={cpuPart} onSelect={() => {}} />
            <PartRow part={gpuPartIncompatible} onSelect={() => {}} />
            <PartRow part={cpuPart} selected onSelect={() => {}} />
            <PartRow part={ramPartDeltaUp} onSelect={() => {}} />
            <PartRow part={ramPartDeltaDown} onSelect={() => {}} />
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">PartPickerDrawer</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
            Open PartPickerDrawer
          </Button>
          <PartPickerDrawer
            open={pickerOpen}
            onOpenChange={setPickerOpen}
            slotLabel="CPU"
            parts={cpuCandidates}
            onSelect={() => setPickerOpen(false)}
          />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">FixDrawer</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => setFixOpen(true)}>
            Open FixDrawer
          </Button>
          <FixDrawer
            open={fixOpen}
            onOpenChange={setFixOpen}
            issueMessage="Your graphics card draws more power than your selected PSU can safely deliver."
            candidates={gpuFixCandidates}
            onSelectCandidate={() => setFixOpen(false)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <h2 className="text-headline-md text-on-surface">Compatibility &amp; meters</h2>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">PowerMeter</h3>
          <PowerMeter
            typicalDrawWatts={320}
            peakDrawWatts={480}
            recommendedPsuWatts={650}
            selectedPsuWatts={750}
            className="max-w-md"
          />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">BalanceMeter</h3>
          <BalanceMeter
            score={32}
            suggestion="Your processor will hold back this graphics card at 1080p. Moving to a Ryzen 7 7700 (+रु 12,400) would unlock roughly 15–20% more frames."
            className="max-w-md"
          />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">
            IssueRow — all three severities
          </h3>
          <div className="flex flex-col gap-2">
            {ISSUE_SEVERITIES.map(({ severity, message }) => (
              <IssueRow
                key={severity}
                severity={severity}
                message={message}
                onFix={severity === "info" ? undefined : () => setFixOpen(true)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">CompatibilityPanel</h3>
          <CompatibilityPanel
            compatibilityScore={72}
            issueCount={{ error: 1, warning: 2, info: 1 }}
            powerMeterProps={{
              typicalDrawWatts: 320,
              peakDrawWatts: 480,
              recommendedPsuWatts: 650,
              selectedPsuWatts: 750,
            }}
            balanceMeterProps={{
              score: 32,
              suggestion: "Your processor will hold back this graphics card at 1080p.",
            }}
            className="max-w-md"
          />
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <h2 className="text-headline-md text-on-surface">Summary &amp; sharing</h2>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">BuildSummaryPanel</h3>
          <BuildSummaryPanel
            totalPrice={12500000}
            isComplete={false}
            incompleteReason="Pick a power supply to continue."
            autosaveStatus="saved"
            upgradeSuggestions={[
              {
                message: "Your processor will hold back this graphics card at 1080p.",
                priceDeltaPaisa: 1240000,
                benefitLabel: "~15–20% more frames",
              },
            ]}
            onShare={() => setShareOpen(true)}
            onPrintPdf={() => {}}
            onAddToCart={() => {}}
            className="max-w-md"
          />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">BuildShareDialog</h3>
          <Button type="button" variant="outline" size="sm" onClick={() => setShareOpen(true)}>
            Open BuildShareDialog
          </Button>
          <BuildShareDialog
            open={shareOpen}
            onOpenChange={setShareOpen}
            shareUrl="https://citycomputer.com.np/build/a7Kd93Xq"
          />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">BuildCompare</h3>
          <BuildCompare builds={compareBuilds} onRemove={() => {}} />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">UpgradeSuggestionCard</h3>
          <UpgradeSuggestionCard
            message="Your processor will hold back this graphics card at 1080p."
            priceDeltaPaisa={1240000}
            benefitLabel="~15–20% more frames"
            onApply={() => {}}
            className="max-w-md"
          />
        </div>

        <div className="flex flex-col gap-3">
          <h3 className="text-body-lg font-semibold text-on-surface">ExpertTipCard</h3>
          <ExpertTipCard
            title="Why RAM speed matters"
            body="Faster memory can meaningfully improve frame rates on AMD platforms — look for at least DDR5-6000 if your motherboard supports it."
            onDismiss={() => {}}
            className="max-w-md"
          />
        </div>
      </div>
    </section>
  );
}
