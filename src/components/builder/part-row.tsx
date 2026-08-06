"use client";

import { ProductImage } from "@/components/commerce/product-image";
import { AlertTriangle, Check } from "lucide-react";
import { PriceBlock } from "@/components/commerce/price-block";
import { StockBadge } from "@/components/commerce/stock-badge";
import { formatNPR } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * PartRow — docs/08-PC-BUILDER-ENGINE.md §9 "Part picker": the reusable
 * candidate-part row rendered inside both `PartPickerDrawer` (browsing the
 * full catalogue for a slot) and `FixDrawer` (browsing a narrower set of
 * alternatives for an issue). One row shape, two callers, so a spec/price/
 * compatibility change in this file lands everywhere a part is listed.
 *
 * Per §1 principle 1 ("Prevent, don't scold") and §9 "Prevention affordances"
 * ("Incompatible parts render... visibly disabled, greyed, with a short
 * reason inline and a 'why?' tooltip"): when `compatible === false` the row
 * is a real `disabled` `<button>` (greyed via `opacity-50`, not removable
 * from the DOM — a disabled-but-visible row *is* the affordance), shows
 * `incompatibleReason` inline in a warning tone next to an `AlertTriangle`
 * icon, and repeats that same reason as a native `title` tooltip for the
 * "why?" fallback the doc calls for. `compatible`/`incompatibleReason` are
 * plain props — this component never invents or evaluates compatibility
 * rules itself.
 *
 * Selected state is never colour alone (docs/05-DESIGN-SYSTEM.md §5 A6): a
 * visible `Check` icon accompanies the `border-primary-container` treatment.
 *
 * `"use client"` — `onSelect` is wired directly to this file's own `<button>`
 * via `onClick`, the same convention `cart-line-item.tsx`/`step-rail.tsx`
 * already established: a function prop attached to a host element can't
 * cross the Server -> Client boundary, so the component that owns the
 * handler must itself be a Client Component.
 *
 * The whole row is ONE real, focusable `<button type="button">` (not a `div`
 * with a manual `onKeyDown`) so it's keyboard-operable for free per docs/05
 * §5 A4, and it's `min-h-[44px]` for the §5 A9 44×44 touch target — the
 * `size-14` (56px) thumbnail already clears that on its own.
 *
 * Trailing price column: normally a plain `PriceBlock`. When
 * `priceDeltaPaisa` is supplied (the `FixDrawer` case — "each row expandable
 * into a Fix drawer listing candidate parts with price deltas", §9),
 * `PriceBlock` has no delta-rendering mode, so this row hand-writes a signed
 * delta line instead: `+रु 4,500` for an increase (warmer, `text-warning`
 * tone) or `-रु 1,200` for a decrease (`text-success` tone) via
 * `formatNPR(Math.abs(priceDeltaPaisa))` with an explicit sign prefix — the
 * sign is the non-colour signal, per §5 A6, with colour only reinforcing it.
 * A delta of exactly zero renders a neutral `+रु 0` in `text-on-surface-variant`
 * (no meaningful direction to signal).
 */
export interface PartRowData {
  id: string;
  imageUrl: string;
  imageAlt: string;
  name: string;
  /** Short key-spec fragments, e.g. ["8 cores", "AM5", "65W"]. */
  specs: string[];
  /** Current price, integer paisa. */
  price: number;
  /** Original/compare-at price, integer paisa. */
  compareAtPrice?: number;
  stockStatus: "in-stock" | "low-stock" | "out-of-stock" | "preorder" | "pickup-only";
  /** When false, this part cannot be selected for the current build. */
  compatible: boolean;
  /** Plain-language reason shown when `compatible` is false — never a rule code. */
  incompatibleReason?: string;
  /** Price delta vs. whatever this row is being compared against (used by FixDrawer) — e.g. +450000 (paisa) means रु 4,500 more. */
  priceDeltaPaisa?: number;
}

export interface PartRowProps {
  part: PartRowData;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
}

export function PartRow({ part, selected = false, onSelect, className }: PartRowProps) {
  const {
    imageUrl,
    imageAlt,
    name,
    specs,
    price,
    compareAtPrice,
    stockStatus,
    compatible,
    incompatibleReason,
    priceDeltaPaisa,
  } = part;

  const priceDelta = typeof priceDeltaPaisa === "number" ? priceDeltaPaisa : null;

  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!compatible}
      aria-pressed={selected}
      title={!compatible ? incompatibleReason : undefined}
      className={cn(
        "flex min-h-[44px] w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
        "bg-surface-container hover:bg-surface-container-high",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-50",
        selected ? "border-primary-container shadow-glow" : "border-glass-stroke",
        className,
      )}
    >
      <div className="relative size-14 shrink-0 overflow-hidden rounded bg-surface-container-high">
        <ProductImage src={imageUrl} alt={imageAlt} sizes="56px" className="object-contain" />
      </div>

      <div className="flex flex-1 flex-col gap-1 overflow-hidden text-left">
        <div className="flex items-center gap-1.5">
          {selected && (
            <Check className="size-4 shrink-0 text-primary-container" aria-hidden="true" />
          )}
          <span className="line-clamp-1 text-body-md font-medium text-on-surface">{name}</span>
        </div>

        {specs.length > 0 && (
          <span className="line-clamp-1 text-label-mono-xs text-on-surface-variant">
            {specs.join(" · ")}
          </span>
        )}

        <StockBadge status={stockStatus} />

        {!compatible && incompatibleReason && (
          <span className="flex items-center gap-1 text-label-mono-xs text-warning">
            <AlertTriangle className="size-3 shrink-0" aria-hidden="true" />
            {incompatibleReason}
          </span>
        )}
      </div>

      <div className="shrink-0 text-right">
        {priceDelta === null ? (
          <PriceBlock price={price} compareAtPrice={compareAtPrice} size="sm" />
        ) : (
          <span
            className={cn(
              "text-body-md font-semibold tabular-nums",
              priceDelta > 0 && "text-warning",
              priceDelta < 0 && "text-success",
              priceDelta === 0 && "text-on-surface-variant",
            )}
          >
            {priceDelta < 0 ? "-" : "+"}
            {formatNPR(Math.abs(priceDelta))}
          </span>
        )}
      </div>
    </button>
  );
}
