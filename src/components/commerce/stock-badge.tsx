import { AlertTriangle, CheckCircle2, Clock, Store, XCircle } from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * StockBadge — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "StockBadge (in stock / low / out / preorder / pickup-only)".
 *
 * Per docs/05 §5 A6 ("status never communicated by colour alone") every
 * status here pairs a `Badge` tone with both an icon and label text —
 * never a bare colour chip. Copy follows §9 ("sentence case", "confident,
 * specific, no hype" storefront voice).
 */
export interface StockBadgeProps {
  status: "in-stock" | "low-stock" | "out-of-stock" | "preorder" | "pickup-only";
  /** Remaining units, used to sharpen the "low stock" label when known. */
  quantity?: number;
  className?: string;
}

const stockConfig: Record<
  StockBadgeProps["status"],
  {
    icon: typeof CheckCircle2;
    variant: NonNullable<BadgeProps["variant"]>;
    label: (quantity?: number) => string;
  }
> = {
  "in-stock": {
    icon: CheckCircle2,
    variant: "success",
    label: () => "In stock",
  },
  "low-stock": {
    icon: AlertTriangle,
    variant: "warning",
    label: (quantity) => (typeof quantity === "number" ? `Only ${quantity} left` : "Low stock"),
  },
  "out-of-stock": {
    icon: XCircle,
    variant: "danger",
    label: () => "Out of stock",
  },
  preorder: {
    icon: Clock,
    variant: "primary",
    label: () => "Available for preorder",
  },
  "pickup-only": {
    icon: Store,
    variant: "glass",
    label: () => "Pickup only",
  },
};

export function StockBadge({ status, quantity, className }: StockBadgeProps) {
  // `status` is the closed `StockBadgeProps["status"]` union, not arbitrary
  // input — safe to index.
  // eslint-disable-next-line security/detect-object-injection
  const { icon: Icon, variant, label } = stockConfig[status];

  return (
    <Badge variant={variant} className={cn(className)}>
      <Icon className="size-3" aria-hidden="true" />
      {label(quantity)}
    </Badge>
  );
}
