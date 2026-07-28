"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuantityStepper } from "@/components/commerce/quantity-stepper";
import { StockBadge } from "@/components/commerce/stock-badge";
import { formatNPR } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * CartLineItem — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "CartLineItem". One row in the cart's 8-column line-item list (§8 "Cart:
 * 8/4 split: line items ‖ sticky summary") and, unchanged, in `MiniCartDrawer`.
 *
 * `"use client"` — this component has zero hooks, but it attaches
 * `onClick={onRemove}` directly to its own remove `Button` in its own render
 * tree (not merely forwarding `onRemove` down as an unused prop). That's the
 * same situation `compare-table.tsx` already ruled on in this codebase: "a
 * component with no state doesn't need the directive" only holds when the
 * component *also* has no DOM event handlers of its own — a function prop
 * attached to a host/primitive element can't be serialized across the
 * Server -> Client boundary, so the component that owns the handler (this
 * one) must itself be a Client Component, independent of whether its caller
 * is one already. `onQuantityChange` is forwarded into `QuantityStepper`
 * (itself already `"use client"`) rather than bound to a local handler here,
 * but the remove button alone is enough to require the directive.
 *
 * States (docs/05 §7): *Partial* — "e.g. some cart items out of stock" — when
 * `isOutOfStock`, the row shows a `StockBadge` (icon + text, never colour
 * alone per §5 A6) next to the title, dims the thumbnail, and disables the
 * `QuantityStepper`; this component only makes the state visually
 * unmistakable, it does not decide what the cart page does about checkout
 * eligibility. *Optimistic* — quantity/removal are plain callbacks with no
 * local pending state of their own; the caller (which owns the actual cart
 * state) is responsible for applying the change immediately and rolling
 * back on failure.
 *
 * The remove button meets the §5 A9 44×44 minimum touch target via
 * `Button`'s `size="md"` + `iconOnly` (`size-11`), and carries an explicit
 * `aria-label` per §5 A2.
 *
 * Line total is a plain `formatNPR(unitPrice * quantity)` rather than
 * `PriceBlock` — `PriceBlock` exists for a single unit's price with an
 * optional compare-at strike-through, a concept that doesn't apply to a
 * line *total*, so reaching for it here would be misleading.
 */
export interface CartLineItemData {
  /**
   * The real cart-line identity. Added alongside `productSlug` (kept for
   * the product link) once this component was actually wired to a live
   * cart (docs/17 Phase 6): a product can have more than one of its
   * variants in the cart at once, which `productSlug` alone can't
   * disambiguate — every mutation callback is keyed by this, not the slug.
   */
  variantId: string;
  productSlug: string;
  imageUrl: string;
  imageAlt: string;
  displayTitle: string;
  /** e.g. "16GB RAM · 512GB SSD". */
  variantLabel?: string;
  /** Integer paisa. */
  unitPrice: number;
  quantity: number;
  /** Caps the `QuantityStepper`, e.g. remaining stock. */
  maxQuantity?: number;
  /** "Partial" state (§7): the product went out of stock since being added to the cart. */
  isOutOfStock?: boolean;
}

export interface CartLineItemProps {
  item: CartLineItemData;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  className?: string;
}

export function CartLineItem({ item, onQuantityChange, onRemove, className }: CartLineItemProps) {
  const {
    productSlug,
    imageUrl,
    imageAlt,
    displayTitle,
    variantLabel,
    unitPrice,
    quantity,
    maxQuantity,
    isOutOfStock = false,
  } = item;

  const productHref = `/p/${productSlug}`;
  const lineTotal = unitPrice * quantity;

  return (
    <div className={cn("flex gap-4 py-4", className)}>
      <Link href={productHref} className="relative block size-20 shrink-0 overflow-hidden rounded">
        <Image
          src={imageUrl}
          alt={imageAlt}
          fill
          sizes="80px"
          className={cn("aspect-square object-cover", isOutOfStock && "opacity-75")}
        />
      </Link>

      <div className="flex flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={productHref}
                className="rounded text-body-md font-medium text-on-surface hover:text-primary-container"
              >
                {displayTitle}
              </Link>
              {isOutOfStock && <StockBadge status="out-of-stock" />}
            </div>
            {variantLabel && <p className="text-body-sm text-on-surface-variant">{variantLabel}</p>}
          </div>

          <Button
            type="button"
            variant="ghost"
            size="md"
            iconOnly
            onClick={onRemove}
            aria-label={`Remove ${displayTitle} from cart`}
            className="shrink-0 text-on-surface-variant hover:text-error"
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <QuantityStepper
            value={quantity}
            onChange={onQuantityChange}
            max={maxQuantity}
            disabled={isOutOfStock}
          />
          <span className="text-price text-on-surface">{formatNPR(lineTotal)}</span>
        </div>
      </div>
    </div>
  );
}
