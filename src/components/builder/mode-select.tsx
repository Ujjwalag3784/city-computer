"use client";

import type { ComponentType } from "react";
import { ListOrdered, Sparkles, SlidersHorizontal } from "lucide-react";
import { RadioGroup } from "@/components/ui/radio-group";
import { RadioCard } from "@/components/commerce/radio-card";
import { cn } from "@/lib/utils";

/**
 * ModeSelect — docs/08-PC-BUILDER-ENGINE.md §9 "UX specification" -> "Modes"
 * table:
 *
 *   Guided   | First-time builders | 6 questions in plain language -> a
 *              complete validated build -> review and swap.
 *   Standard | Most users           | 10-step rail matching the approved
 *              design. Budget sidebar. Each step pre-filtered by prior
 *              choices.
 *   Expert   | Enthusiasts          | Flat slot grid, all slots open, no
 *              gating, full filters and comparison.
 *
 * §9 also states "Mode is switchable at any time without losing the
 * build" — a hard requirement that shapes this component's copy: none of
 * the three descriptions below frame switching as "starting over" (there is
 * no "reset"/"restart" language anywhere here), because the build itself
 * survives a mode change. This component only renders the choice; carrying
 * the build across a mode switch is the future `/build` page's job.
 *
 * `"use client"` — `RadioGroup`'s `onValueChange` is a function prop wired
 * directly here (`onValueChange={(next) => onChange(next as BuilderMode)}`),
 * the same "handler owned by this file" reasoning `radio-card.tsx`'s own
 * callers and `cart-line-item.tsx` already establish in this codebase.
 *
 * Composition follows `radio-card.tsx`'s documented usage exactly: one
 * `RadioGroup` wrapping one `RadioCard` per mode, each with a leading icon
 * placed in `RadioCard`'s `trailing` slot (its only slot besides
 * `title`/`description`) — `Sparkles` for Guided, `ListOrdered` for
 * Standard, `SlidersHorizontal` for Expert.
 */
export type BuilderMode = "guided" | "standard" | "expert";

interface ModeOption {
  value: BuilderMode;
  title: string;
  description: string;
  icon: ComponentType<{ className?: string }>;
}

const MODE_OPTIONS: ModeOption[] = [
  {
    value: "guided",
    title: "Guided",
    description:
      "Answer a few plain questions and we'll put together a complete build for you to review and swap parts on.",
    icon: Sparkles,
  },
  {
    value: "standard",
    title: "Standard",
    description:
      "Work through a 10-step rail with a running budget total. Each step is pre-filtered by what you've already chosen.",
    icon: ListOrdered,
  },
  {
    value: "expert",
    title: "Expert",
    description:
      "See every slot at once, open and ungated, with full filters and side-by-side comparison.",
    icon: SlidersHorizontal,
  },
];

export interface ModeSelectProps {
  value: BuilderMode;
  onChange: (mode: BuilderMode) => void;
  className?: string;
}

export function ModeSelect({ value, onChange, className }: ModeSelectProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(next as BuilderMode)}
      className={cn("grid gap-2", className)}
    >
      {MODE_OPTIONS.map((option) => {
        const Icon = option.icon;
        return (
          <RadioCard
            key={option.value}
            value={option.value}
            title={option.title}
            description={option.description}
            trailing={<Icon className="size-5 text-on-surface-variant" aria-hidden="true" />}
          />
        );
      })}
    </RadioGroup>
  );
}
