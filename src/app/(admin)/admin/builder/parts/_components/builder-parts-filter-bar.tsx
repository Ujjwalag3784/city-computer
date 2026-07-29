"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

/**
 * Filter bar for `/admin/builder/parts` — a confidence chip row plus a
 * part-type `Select`, both driving the URL (`?confidence=`/`?partType=`)
 * rather than client state, same "server-rendered from the URL" rule
 * `AdminSearchBox`'s own doc comment establishes. This is a small,
 * page-local component rather than a second use of the shared
 * `AdminFilterChips` (`src/components/admin/admin-filter-chips.tsx`)
 * because that component only ever manages one hardcoded `?filter=`
 * param — this page needs two independent filter dimensions that must
 * compose (picking a part type must never silently drop a confidence
 * filter and vice versa), which means each chip/option link here is built
 * from the *current* `searchParams`, not just `basePath` + `q`.
 */
const CONFIDENCE_OPTIONS = [
  { value: "all", label: "All confidence" },
  { value: "VERIFIED", label: "Verified" },
  { value: "INFERRED", label: "Inferred" },
  { value: "UNVERIFIED", label: "Unverified" },
];

const PART_TYPE_OPTIONS = [
  { value: "all", label: "All types" },
  { value: "CPU", label: "CPU" },
  { value: "CPU_COOLER", label: "CPU Cooler" },
  { value: "MOTHERBOARD", label: "Motherboard" },
  { value: "RAM", label: "RAM" },
  { value: "GPU", label: "GPU" },
  { value: "STORAGE", label: "Storage" },
  { value: "PSU", label: "PSU" },
  { value: "CASE", label: "Case" },
  { value: "CASE_FAN", label: "Case Fan" },
  { value: "MONITOR", label: "Monitor" },
  { value: "OS", label: "OS" },
  { value: "CAPTURE_CARD", label: "Capture Card" },
  { value: "SOUND_CARD", label: "Sound Card" },
  { value: "NETWORK_CARD", label: "Network Card" },
  { value: "THERMAL_PASTE", label: "Thermal Paste" },
  { value: "ACCESSORY", label: "Accessory" },
];

export function BuilderPartsFilterBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const activeConfidence = searchParams.get("confidence") ?? "all";
  const activePartType = searchParams.get("partType") ?? "all";

  function hrefFor(param: "confidence" | "partType", value: string): string {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") params.delete(param);
    else params.set(param, value);
    const qs = params.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by data confidence">
        {CONFIDENCE_OPTIONS.map((option) => {
          const isActive = activeConfidence === option.value;
          return (
            <Link
              key={option.value}
              href={hrefFor("confidence", option.value)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "rounded-full border px-3 py-1.5 text-body-sm transition-colors",
                isActive
                  ? "border-primary-container bg-primary-container text-on-primary-container"
                  : "border-glass-stroke text-on-surface-variant hover:border-primary-container hover:text-on-surface",
              )}
            >
              {option.label}
            </Link>
          );
        })}
      </div>

      <Select
        value={activePartType}
        onValueChange={(next) => router.push(hrefFor("partType", next))}
      >
        <SelectTrigger className="w-full sm:w-[220px]" aria-label="Filter by part type">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PART_TYPE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
