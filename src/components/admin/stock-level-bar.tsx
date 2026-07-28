import { cn } from "@/lib/utils";

/**
 * StockLevelBar — the coloured stock bar referenced by docs/09-ADMIN-DAD-
 * MODE.md §5.2 "Product list": "...stock with a coloured bar, status pill...".
 * This component is the bar itself; a `StockBadge` (see
 * `src/components/commerce/stock-badge.tsx`) is the separate status pill,
 * typically rendered alongside it in a product-list row or `DataTable` cell.
 *
 * `lowStockThreshold` defaults to `3`, matching docs/09 §6's stated default
 * low-stock threshold ("Almost out of stock: `StockLevel.quantity <=
 * lowStockThreshold`" uses the same default unless a product overrides it).
 *
 * `maxDisplayQuantity` defaults to `20` — a deliberate, undocumented visual
 * cap chosen for this component only: the bar's fill is a proportion of
 * this cap, not of some theoretical maximum stock. Without a cap, "500 in
 * stock" and "550 in stock" would render as a visually identical full bar
 * (any healthy stock level saturates the bar past a certain point anyway),
 * so capping the *scale* at a modest number keeps the bar meaningful for
 * the common low-stock range without needing per-product tuning of what
 * "full" means.
 *
 * Per docs/05-DESIGN-SYSTEM.md §5 A6 ("status never communicated by colour
 * alone") the bar's fill colour (`danger`/`warning`/`success`) is always
 * paired with the literal `quantity` rendered as text next to it — colour
 * is a secondary reinforcement, not the only signal.
 *
 * No `"use client"`: a static, presentational read of `quantity`, no
 * interactivity.
 */
export interface StockLevelBarProps {
  quantity: number;
  lowStockThreshold?: number;
  maxDisplayQuantity?: number;
  className?: string;
}

export function StockLevelBar({
  quantity,
  lowStockThreshold = 3,
  maxDisplayQuantity = 20,
  className,
}: StockLevelBarProps) {
  const fillPercent = Math.min(100, (Math.max(0, quantity) / maxDisplayQuantity) * 100);

  const tone = quantity === 0 ? "danger" : quantity <= lowStockThreshold ? "warning" : "success";

  const label =
    quantity === 0
      ? "Out of stock"
      : quantity <= lowStockThreshold
        ? `Only ${quantity} left`
        : `${quantity} in stock`;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        role="img"
        aria-label={label}
        className="h-2 w-full min-w-16 overflow-hidden rounded-full bg-surface-container-high"
      >
        <div
          className={cn(
            "h-full rounded-full transition-[width]",
            tone === "danger" && "bg-danger",
            tone === "warning" && "bg-warning",
            tone === "success" && "bg-success",
          )}
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <span className="shrink-0 text-body-sm text-on-surface-variant tabular-nums">{quantity}</span>
    </div>
  );
}
