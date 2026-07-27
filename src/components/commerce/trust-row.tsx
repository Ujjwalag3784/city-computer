import * as React from "react";
import { ShieldCheck, Truck, RotateCcw, Banknote } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * TrustRow — docs/05-DESIGN-SYSTEM.md §8 home page structure: "→ value
 * props →" ahead of the footer. A horizontal band of short, concrete trust
 * signals. Copy follows docs/05 §9 voice rules (sentence case, "confident,
 * specific, no hype" — e.g. "In stock at New Road" beats "Available now!"),
 * so the default labels below are plain facts, not marketing claims.
 */
export interface TrustRowItem {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

export interface TrustRowProps {
  items?: TrustRowItem[];
  className?: string;
}

// Typed as a non-optional `TrustRowItem[]` (not `TrustRowProps["items"]`,
// which would still include `undefined`) so the destructured default below
// narrows `items` to a guaranteed-defined array inside the component body.
const DEFAULT_ITEMS: TrustRowItem[] = [
  { icon: ShieldCheck, label: "Genuine products" },
  { icon: Truck, label: "Nationwide delivery" },
  { icon: RotateCcw, label: "7-day replacement" },
  { icon: Banknote, label: "Cash on delivery available" },
];

export function TrustRow({ items = DEFAULT_ITEMS, className }: TrustRowProps) {
  return (
    <div className={cn("flex flex-wrap items-center justify-center gap-8", className)}>
      {items.map(({ icon: Icon, label }) => (
        <div key={label} className="flex items-center gap-2.5">
          <Icon className="size-5 shrink-0 text-primary-container" />
          <span className="text-body-sm text-on-surface-variant">{label}</span>
        </div>
      ))}
    </div>
  );
}
