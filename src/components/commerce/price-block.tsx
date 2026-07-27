import { Badge } from "@/components/ui/badge";
import { formatNPR } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * PriceBlock — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "PriceBlock (with compare-at strike-through — missing from the designs)".
 * The Stitch exports never rendered a compare-at price at all; this closes
 * that gap with a struck-through original price plus a discount `Badge`.
 *
 * Per docs/05 §5 A6 ("status never communicated by colour alone") the
 * discount is never conveyed by the strike-through/badge colour alone — the
 * badge always carries the `-NN%` text alongside its tone.
 *
 * `price`/`compareAtPrice` are integer paisa (docs/06-DATA-MODEL.md §4),
 * formatted only at this edge via `formatNPR` — never rendered as a float
 * rupee value.
 */
export interface PriceBlockProps {
  /** Current price, in integer paisa. */
  price: number;
  /** Original/compare-at price, in integer paisa. Must be greater than `price` to render. */
  compareAtPrice?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const priceSizeClass: Record<NonNullable<PriceBlockProps["size"]>, string> = {
  sm: "text-body-md font-semibold",
  md: "text-price",
  lg: "text-price-lg",
};

export function PriceBlock({ price, compareAtPrice, size = "md", className }: PriceBlockProps) {
  // Narrow through a single `number | null` local instead of a separate
  // boolean flag, so every downstream use of the compare-at price stays
  // type-safe without relying on TS aliasing a boolean back to a guard.
  const compareAt =
    typeof compareAtPrice === "number" && compareAtPrice > price ? compareAtPrice : null;
  const discountPercent = compareAt !== null ? Math.round((1 - price / compareAt) * 100) : null;

  return (
    <div className={cn("flex flex-col gap-0.5", className)}>
      <div className="flex items-baseline gap-2">
        {/* `size` is the closed `PriceBlockProps["size"]` union — safe to index. */}
        {/* eslint-disable-next-line security/detect-object-injection */}
        <span className={cn(priceSizeClass[size], "text-on-surface")}>{formatNPR(price)}</span>
        {discountPercent !== null && discountPercent > 0 && (
          <Badge variant="danger">-{discountPercent}%</Badge>
        )}
      </div>
      {compareAt !== null && (
        <span className="text-body-sm text-on-surface-variant line-through">
          {formatNPR(compareAt)}
        </span>
      )}
    </div>
  );
}
