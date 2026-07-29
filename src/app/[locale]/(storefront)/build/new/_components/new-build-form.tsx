"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ModeSelect, type BuilderMode } from "@/components/builder/mode-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createBuildAction } from "../../_actions";

/**
 * NewBuildForm — the client half of `/build/new` (Task #73). Captures the
 * four fields `Build` itself stores at creation (`mode`, `useCase`,
 * `targetResolution`, `budgetPaisa`), calls `createBuildAction`, then
 * redirects to `/build/{shortId}/edit` to fill in parts.
 *
 * `budget` is kept as a plain rupee string in local state (never floats in
 * money math per this project's own rule) and converted to an integer
 * paisa figure only at submit time via `Math.round(Number(budget) * 100)`
 * — an empty field means "no budget cap" (`budgetPaisa: null`), matching
 * `createBuildSchema`'s own `.nullable()`.
 */
const USE_CASE_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "GAMING", label: "Gaming" },
  { value: "CONTENT_CREATION", label: "Content creation" },
  { value: "THREE_D_RENDERING", label: "3D rendering" },
  { value: "STREAMING", label: "Streaming" },
  { value: "PROGRAMMING", label: "Programming" },
  { value: "AI_ML", label: "AI / machine learning" },
  { value: "OFFICE", label: "Office" },
  { value: "GENERAL", label: "General use" },
];

const RESOLUTION_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "FHD", label: "1920×1080 (Full HD)" },
  { value: "QHD", label: "2560×1440 (QHD)" },
  { value: "UHD", label: "3840×2160 (4K)" },
  { value: "ULTRAWIDE", label: "Ultrawide" },
];

const MODE_TO_ENUM: Record<BuilderMode, "GUIDED" | "STANDARD" | "EXPERT"> = {
  guided: "GUIDED",
  standard: "STANDARD",
  expert: "EXPERT",
};

export function NewBuildForm() {
  const router = useRouter();
  const [mode, setMode] = useState<BuilderMode>("guided");
  const [useCase, setUseCase] = useState("GAMING");
  const [targetResolution, setTargetResolution] = useState("FHD");
  const [budget, setBudget] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    const trimmedBudget = budget.trim();
    const budgetPaisa = trimmedBudget === "" ? null : Math.round(Number(trimmedBudget) * 100);

    const result = await createBuildAction({
      // `mode` is the closed `BuilderMode` union, not arbitrary input.
      // eslint-disable-next-line security/detect-object-injection
      mode: MODE_TO_ENUM[mode],
      useCase,
      targetResolution,
      budgetPaisa,
    });

    if (!result.ok || !result.data) {
      setSubmitting(false);
      toast.error(result.message ?? "Couldn't start a new build.");
      return;
    }
    router.push(`/build/${result.data.shortId}/edit`);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-6">
      <Card variant="glass">
        <CardHeader>
          <span className="text-title text-on-surface">Mode</span>
        </CardHeader>
        <CardContent>
          <ModeSelect value={mode} onChange={setMode} />
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardHeader>
          <span className="text-title text-on-surface">What&apos;s this build for?</span>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="build-use-case">Primary use</Label>
            <Select value={useCase} onValueChange={setUseCase}>
              <SelectTrigger id="build-use-case">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {USE_CASE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="build-resolution">Target resolution</Label>
            <Select value={targetResolution} onValueChange={setTargetResolution}>
              <SelectTrigger id="build-resolution">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESOLUTION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="build-budget">Budget (रु), optional</Label>
            <Input
              id="build-budget"
              type="number"
              min={0}
              step={500}
              inputMode="numeric"
              placeholder="e.g. 150000"
              value={budget}
              onChange={(event) => setBudget(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" variant="primary" glow disabled={submitting} className="w-full">
        {submitting ? "Starting…" : "Start building"}
      </Button>
    </form>
  );
}
