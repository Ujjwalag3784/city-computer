"use client";

import Link from "next/link";
import { X } from "lucide-react";
import { PriceBlock } from "@/components/commerce/price-block";
import { cn } from "@/lib/utils";

/**
 * BuildCompare — up to 4 builds side by side, same up-to-4 pattern as
 * `src/components/commerce/compare-table.tsx` (for products), applied here
 * to whole builds instead of catalogue products. Deliberately not built by
 * importing/reusing `CompareTable` directly — builds carry a different
 * shape (`keyParts`/`estimatedFpsRange` vs. products' `specRows`), so this
 * component hand-rolls the same structural approach rather than forcing a
 * shared component to serve two different data shapes.
 *
 * `"use client"`: `onRemove` is attached directly to a native `<button>` in
 * this file's own render tree — the same "handler owned by this file"
 * reasoning `compare-table.tsx` already established in this codebase (a
 * function prop on a host element can't cross the Server -> Client
 * boundary, so the component that *owns* the handler must itself be a
 * Client Component).
 *
 * Layout: a horizontally-scrollable table (`overflow-x-auto`) with a fixed
 * left label column and one column per build (up to 4). Part rows are built
 * from the *union* of every build's `keyParts[].slotLabel` values,
 * preserving first-seen order — builds don't all carry the same slot set
 * (e.g. a build missing an optional cooler) — with "—" for any build
 * missing that particular slot. A final `estimatedFpsRange` row only
 * appears when at least one build provides it; that string is pre-formatted
 * by the caller (e.g. from the FPS-estimation model), never computed here.
 *
 * Zebra-striped rows (`odd:bg-surface-container-high`) match
 * `compare-table.tsx`'s own convention for this structurally similar but
 * differently-fielded wider table.
 */
export interface CompareBuild {
  id: string;
  /** e.g. "Gaming build #1". */
  label: string;
  /** Integer paisa. */
  totalPrice: number;
  /** e.g. [{ slotLabel: "CPU", partName: "Ryzen 5 7600" }, ...]. */
  keyParts: { slotLabel: string; partName: string }[];
  /** Pre-formatted, e.g. "90–110 FPS at 1440p" — not computed here. */
  estimatedFpsRange?: string;
}

export interface BuildCompareProps {
  builds: CompareBuild[];
  onRemove: (id: string) => void;
  className?: string;
}

function buildSlotLabelOrder(builds: CompareBuild[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const build of builds) {
    for (const part of build.keyParts) {
      if (!seen.has(part.slotLabel)) {
        seen.add(part.slotLabel);
        order.push(part.slotLabel);
      }
    }
  }
  return order;
}

export function BuildCompare({ builds, onRemove, className }: BuildCompareProps) {
  if (builds.length === 0) {
    return (
      <div className={cn("flex flex-col items-start gap-2", className)}>
        <p className="text-body-sm text-on-surface-variant">
          Add builds to compare them side by side.
        </p>
        <Link
          href="/build"
          className="rounded text-body-sm font-medium text-primary-container hover:underline"
        >
          Start a build
        </Link>
      </div>
    );
  }

  const slotLabels = buildSlotLabelOrder(builds);
  const showFpsRow = builds.some((build) => Boolean(build.estimatedFpsRange));

  // Per-build lookup of slotLabel -> partName, built once so each body row
  // below is a simple map read instead of re-scanning `keyParts` per cell —
  // same idiom as `compare-table.tsx`'s `valuesByProduct`.
  const partsByBuild = builds.map((build) => {
    const map = new Map<string, string>();
    for (const part of build.keyParts) {
      map.set(part.slotLabel, part.partName);
    }
    return map;
  });

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th
              scope="col"
              className="w-40 shrink-0 p-3 align-bottom text-body-sm text-on-surface-variant"
            >
              <span className="sr-only">Slot</span>
            </th>
            {builds.map((build) => (
              <th key={build.id} scope="col" className="min-w-48 p-3 align-bottom">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-body-md font-medium text-on-surface">{build.label}</span>
                    <button
                      type="button"
                      aria-label={`Remove ${build.label} from comparison`}
                      onClick={() => onRemove(build.id)}
                      className={cn(
                        "inline-flex size-11 shrink-0 items-center justify-center rounded text-on-surface-variant transition-colors",
                        "hover:bg-surface-container-high hover:text-on-surface",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <PriceBlock price={build.totalPrice} size="sm" />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {slotLabels.map((slotLabel, rowIndex) => (
            <tr key={slotLabel} className={cn(rowIndex % 2 === 1 && "bg-surface-container-high")}>
              <th scope="row" className="p-3 text-body-sm font-medium text-on-surface-variant">
                {slotLabel}
              </th>
              {builds.map((build, columnIndex) => (
                <td key={build.id} className="p-3 text-body-sm text-on-surface">
                  {/* `columnIndex` comes from this same `builds.map(...)` —
                     always in bounds, never arbitrary input. */}
                  {/* eslint-disable-next-line security/detect-object-injection */}
                  {partsByBuild[columnIndex]?.get(slotLabel) ?? "—"}
                </td>
              ))}
            </tr>
          ))}

          {showFpsRow && (
            <tr className={cn(slotLabels.length % 2 === 1 && "bg-surface-container-high")}>
              <th scope="row" className="p-3 text-body-sm font-medium text-on-surface-variant">
                Estimated FPS
              </th>
              {builds.map((build) => (
                <td key={build.id} className="p-3 text-body-sm text-on-surface">
                  {build.estimatedFpsRange ?? "—"}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
