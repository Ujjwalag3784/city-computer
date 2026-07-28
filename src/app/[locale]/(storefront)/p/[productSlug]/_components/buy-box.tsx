"use client";

import { useMemo, useState } from "react";
import { PriceBlock } from "@/components/commerce/price-block";
import { StockBadge } from "@/components/commerce/stock-badge";
import { AddToCartButton } from "@/components/commerce/add-to-cart-button";
import { VariantSelector, type VariantAttribute } from "@/components/commerce/variant-selector";
import type { ProductVariantDetail } from "@/server/services/catalog/product";

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
}

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

export function BuyBox({ variants }: BuyBoxProps) {
  const attributes = useMemo(() => deriveAttributes(variants), [variants]);
  const defaultVariant = variants.find((variant) => variant.isDefault) ?? variants[0];

  const [selected, setSelected] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const optionValue of defaultVariant?.optionValues ?? []) {
      initial[optionValue.optionType] = optionValue.value;
    }
    return initial;
  });

  const activeVariant = findMatchingVariant(variants, selected) ?? defaultVariant;

  if (!activeVariant) {
    // docs/06-DATA-MODEL.md §4: "Every product has at least one variant" —
    // this branch should be unreachable against well-formed data. Kept as
    // a safe fallback rather than crashing the whole PDP over one bad
    // product row.
    return null;
  }

  const outOfStock = activeVariant.availableQuantity <= 0 && !activeVariant.allowBackorder;

  return (
    <div className="flex flex-col gap-4">
      {attributes.length > 0 && (
        <VariantSelector
          attributes={attributes}
          selected={selected}
          onChange={(attributeName, value) =>
            setSelected((prev) => ({ ...prev, [attributeName]: value }))
          }
        />
      )}

      <PriceBlock
        price={activeVariant.pricePaisa}
        compareAtPrice={activeVariant.compareAtPricePaisa ?? undefined}
        size="lg"
      />

      <StockBadge
        status={outOfStock ? "out-of-stock" : "in-stock"}
        quantity={activeVariant.availableQuantity}
      />

      <AddToCartButton
        // Cart state doesn't exist yet — docs/17-ROADMAP-PHASES.md's Phase
        // 6 ("Cart & Inventory"), not this pass. This resolves immediately
        // so the button's own optimistic "Added" affordance still
        // demonstrates correctly, but nothing is actually persisted
        // anywhere yet; wiring this to a real `addToCart` Server Action is
        // Phase 6's job, not silently faked here.
        onAddToCart={() => Promise.resolve()}
        outOfStock={outOfStock}
        disabled={outOfStock}
        className="mt-2 sm:w-fit"
      />
    </div>
  );
}
