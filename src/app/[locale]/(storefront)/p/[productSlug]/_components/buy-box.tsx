"use client";

import { useMemo, useState } from "react";
import { Truck } from "lucide-react";
import { PriceBlock } from "@/components/commerce/price-block";
import { StockBadge } from "@/components/commerce/stock-badge";
import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { QuantityStepper } from "@/components/commerce/quantity-stepper";
import { VariantSelector, type VariantAttribute } from "@/components/commerce/variant-selector";
import type { ProductVariantDetail } from "@/server/services/catalog/product";
import { addToCartAction } from "@/app/[locale]/(storefront)/_actions";
import { useCartStore } from "@/stores/cart-store";

/**
 * BuyBox — the client-interactive half of the PDP (docs/05
 * §6: `VariantSelector`, `PriceBlock`, `StockBadge`, `AddToCartButton`).
 * Route-private (`_components/`): nothing else needs "pick a variant,
 * show its price/stock, add it to cart" outside this one page.
 *
 * `"use client"`: variant selection is local UI state (which combination
 * of options is currently picked) that has no server-rendering
 * counterpart — the page around this component is still a plain Server
 * Component that only fetched the data once.
 */
export interface BuyBoxProps {
  variants: ProductVariantDetail[];
  /** Real delivery line from `delivery-promise.ts`, e.g. "Delivery in 1–2 days (Inside Kathmandu Valley) · रु 150". */
  deliveryPromise?: string;
}

/** Most a shopper can add in one go from the product page. */
const MAX_QUANTITY_PER_ADD = 10;

/** Every distinct (attributeName → [values]) pairing across every variant, in first-seen order — what `VariantSelector` needs to render its option groups ("Memory: 16GB / 32GB", "Storage: 512GB / 1TB"). */
function deriveAttributes(variants: ProductVariantDetail[]): VariantAttribute[] {
  const order: string[] = [];
  const valuesByAttribute = new Map<string, Map<string, string>>();

  for (const variant of variants) {
    for (const optionValue of variant.optionValues) {
      let values = valuesByAttribute.get(optionValue.optionType);
      if (!values) {
        values = new Map();
        valuesByAttribute.set(optionValue.optionType, values);
        order.push(optionValue.optionType);
      }
      values.set(optionValue.value, optionValue.value);
    }
  }

  return order.map((attributeName) => {
    const values = valuesByAttribute.get(attributeName);
    return {
      name: attributeName,
      // JUDGMENT CALL: every option renders `available: true` — this
      // doesn't yet grey out a combination that's out of stock or
      // physically impossible given the *other* currently-selected
      // options. Real per-combination availability needs cross-
      // referencing every variant's stock against the partial selection,
      // which is meaningfully more logic than a PDP's first pass
      // warrants; flagged rather than silently assumed correct.
      options: values
        ? [...values.values()].map((value) => ({ label: value, value, available: true }))
        : [],
    };
  });
}

function findMatchingVariant(
  variants: ProductVariantDetail[],
  selected: Record<string, string>,
): ProductVariantDetail | undefined {
  return variants.find(
    (variant) =>
      variant.optionValues.length === Object.keys(selected).length &&
      variant.optionValues.every(
        (optionValue) => selected[optionValue.optionType] === optionValue.value,
      ),
  );
}

export function BuyBox({ variants, deliveryPromise }: BuyBoxProps) {
  const setCartView = useCartStore((state) => state.setView);
  const openCartDrawer = useCartStore((state) => state.openDrawer);
  const attributes = useMemo(() => deriveAttributes(variants), [variants]);
  const defaultVariant = variants.find((variant) => variant.isDefault) ?? variants[0];

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const optionValue of defaultVariant?.optionValues ?? []) {
      initial[optionValue.optionType] = optionValue.value;
    }
    return initial;
  });

  const [quantity, setQuantity] = useState(1);
  const activeVariant = findMatchingVariant(variants, selected) ?? defaultVariant;

  if (!activeVariant) {
    // docs/06-DATA-MODEL.md §4: "Every product has at least one variant" —
    // this branch should be unreachable against well-formed data. Kept as
    // a safe fallback rather than crashing the whole PDP over one bad
    // product row.
    return null;
  }

  const outOfStock = activeVariant.availableQuantity <= 0 && !activeVariant.allowBackorder;
  // Captured as a plain string here, not read off `activeVariant` inside
  // `handleAddToCart` below — TypeScript's narrowing from the `!activeVariant`
  // guard above doesn't carry into a nested function's own scope, so the
  // closure would otherwise see `activeVariant` widened back to possibly
  // `undefined`.
  const activeVariantId = activeVariant.id;

  async function handleAddToCart() {
    const result = await addToCartAction({ variantId: activeVariantId, quantity });
    if (!result.ok || !result.data) {
      // `AddToCartButton` catches this rejection itself and shows its own
      // "Couldn't add — try again" state (see that component's doc
      // comment) — this is the one place that error surfaces, not a toast
      // here too.
      throw new Error(result.message ?? "Couldn't add to cart");
    }
    setCartView(result.data);
    openCartDrawer();
  }

  const available = activeVariant.availableQuantity;
  const maxQuantity = Math.max(1, Math.min(MAX_QUANTITY_PER_ADD, available > 0 ? available : 1));
  const lowStock = !outOfStock && available > 0 && available <= 3;

  // Stitch PDP: price panel, configuration cards, a stock/delivery panel,
  // then quantity + a full-width add-to-cart.
  return (
    <div className="flex flex-col gap-5">
      <div className="panel flex flex-col gap-3 p-5">
        <PriceBlock
          price={activeVariant.pricePaisa}
          compareAtPrice={activeVariant.compareAtPricePaisa ?? undefined}
          size="lg"
        />
        <p className="font-mono text-label-mono-xs text-on-surface-variant">
          Price includes 13% VAT · SKU {activeVariant.sku}
        </p>
      </div>

      {attributes.length > 0 && (
        <VariantSelector
          attributes={attributes}
          selected={selected}
          onChange={(attributeName, value) =>
            setSelected((prev) => ({ ...prev, [attributeName]: value }))
          }
        />
      )}

      <div className="tile flex flex-col gap-2 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <StockBadge
            status={outOfStock ? "out-of-stock" : lowStock ? "low-stock" : "in-stock"}
            quantity={available}
          />
          {!outOfStock && available > 0 && (
            <span className="font-mono text-label-mono-xs text-on-surface-variant">
              {available} unit{available === 1 ? "" : "s"} at New Road
            </span>
          )}
        </div>
        {deliveryPromise && (
          <p className="flex items-center gap-2 text-body-sm text-on-surface-variant">
            <Truck className="size-4 shrink-0 text-primary" aria-hidden="true" />
            {deliveryPromise}
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <QuantityStepper
          value={quantity}
          onChange={setQuantity}
          min={1}
          max={maxQuantity}
          disabled={outOfStock}
          className="shrink-0"
        />
        <AddToCartButton
          onAddToCart={handleAddToCart}
          outOfStock={outOfStock}
          disabled={outOfStock}
          className="h-12 flex-1"
        />
      </div>
    </div>
  );
}
