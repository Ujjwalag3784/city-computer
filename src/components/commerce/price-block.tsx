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
  sm: "font-display text-[0.9375rem] font-bold tabular-nums",
  md: "text-price",
  lg: "text-price-lg",
};

export function PriceBlock({ price, compareAtPrice, size = "md", className }: PriceBlockProps) {
  const compareAt =
    typeof compareAtPrice === "number" && compareAtPrice > price ? compareAtPrice : null;
  const discountPercent = compareAt !== null ? Math.round((1 - price / compareAt) * 100) : null;
  const onSale = discountPercent !== null && discountPercent > 0;

  // DESIGN.md "Pricing Cluster": Manrope price (orange on a deal), the
  // original price struck through in mono, and a tinted "-7%" pill.
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      {/* `size` is the closed `PriceBlockProps["size"]` union — safe to index. */}
      {/* eslint-disable-next-line security/detect-object-injection */}
      <span className={cn(priceSizeClass[size], onSale ? "text-primary" : "text-on-surface")}>
        {formatNPR(price)}
      </span>
      {compareAt !== null && (
        <span className="font-mono text-[0.75rem] text-on-surface-variant line-through">
          <span className="sr-only">Was </span>
          {formatNPR(compareAt)}
        </span>
      )}
      {onSale && <Badge variant="primary">-{discountPercent}%</Badge>}
    </div>
  );
}
