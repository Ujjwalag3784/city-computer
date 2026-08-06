"use client";

import { ProductImage } from "@/components/commerce/product-image";
import Link from "next/link";
import { X } from "lucide-react";
import { PriceBlock } from "@/components/commerce/price-block";
import { cn } from "@/lib/utils";

/**
 * CompareTable — docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md §2.1 + route map:
 * "Product comparison (up to 4)" at `/compare`, client-side.
 *
 * `"use client"` is required here even though this component has no hooks
 * of its own. It's tempting to reason (as `stepper-nav.tsx` does) that a
 * component with no state doesn't need the directive — but that reasoning
 * only holds when the component has no DOM event handlers either.
 * `CompareTable` attaches `onClick={() => onRemove(slug)}` directly to
 * native `<button>` elements in its own render tree; a function prop on a
 * host element can't be serialized across the server -> client boundary
 * that Server Components rely on, so the component that *owns* the handler
 * must itself be a Client Component — not just the caller wiring the
 * `onRemove` callback.
 *
 * Layout: a horizontally-scrollable table (`overflow-x-auto`) with a fixed
 * left label column and one column per product (up to 4, per docs/02 §2.1).
 * Spec rows are built from the *union* of every product's `specRows[].label`
 * values, preserving first-seen order — products don't all carry identical
 * `specRows` arrays (e.g. a laptop vs. a desktop comparison), so rows are
 * matched by label per-product rather than by array index, with "—" for any
 * product missing that particular spec.
 *
 * Zebra-striped rows (`odd:bg-surface-container-high`) match the convention
 * in `spec-table.tsx`, applied to this structurally different wider table
 * rather than imported from it.
 */
export interface CompareRow {
  label: string;
  /** One value per product, same order as `products`. */
  values: string[];
}

export interface CompareProduct {
  slug: string;
  imageUrl: string;
  imageAlt: string;
  displayTitle: string;
  /** Integer paisa. */
  price: number;
  /** Integer paisa. */
  compareAtPrice?: number;
  specRows: CompareRow[];
}

export interface CompareTableProps {
  products: CompareProduct[];
  onRemove: (slug: string) => void;
  className?: string;
}

function buildSpecLabelOrder(products: CompareProduct[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const product of products) {
    for (const row of product.specRows) {
      if (!seen.has(row.label)) {
        seen.add(row.label);
        order.push(row.label);
      }
    }
  }
  return order;
}

export function CompareTable({ products, onRemove, className }: CompareTableProps) {
  if (products.length === 0) {
    return (
      <div className={cn("flex flex-col items-start gap-2", className)}>
        <p className="text-body-sm text-on-surface-variant">
          Add products to compare them side by side.
        </p>
        <Link
          href="/shop"
          className="rounded text-body-sm font-medium text-primary-container hover:underline"
        >
          Browse products
        </Link>
      </div>
    );
  }

  const specLabels = buildSpecLabelOrder(products);
  // Per-product lookup of label -> value, built once so each body row below
  // is a simple map read instead of re-scanning `specRows` per cell. Each
  // product only contributes a row for a label if it's relevant to that
  // product (docs above); when it does, `row.values[index]` is this
  // product's own slot in that row's per-comparison value array.
  const valuesByProduct = products.map((product, index) => {
    const map = new Map<string, string>();
    for (const row of product.specRows) {
      // `index` comes from `products.map((product, index) => ...)` directly
      // above — always `0 <= index < products.length`, never arbitrary input.
      // eslint-disable-next-line security/detect-object-injection
      const value = row.values[index];
      if (value !== undefined) {
        map.set(row.label, value);
      }
    }
    return map;
  });

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">
        <thead>
          <tr>
            <th
              scope="col"
              className="w-40 shrink-0 p-3 align-bottom text-body-sm text-on-surface-variant"
            >
              <span className="sr-only">Spec</span>
            </th>
            {products.map((product) => (
              <th key={product.slug} scope="col" className="min-w-48 p-3 align-bottom">
                <div className="flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/p/${product.slug}`}
                      className="relative block aspect-square size-16 overflow-hidden rounded-lg bg-surface-container-high"
                    >
                      <ProductImage
                        src={product.imageUrl}
                        alt={product.imageAlt}
                        sizes="64px"
                        className="object-cover"
                      />
                    </Link>
                    <button
                      type="button"
                      aria-label={`Remove ${product.displayTitle} from comparison`}
                      onClick={() => onRemove(product.slug)}
                      className={cn(
                        "inline-flex size-11 shrink-0 items-center justify-center rounded text-on-surface-variant transition-colors",
                        "hover:bg-surface-container-high hover:text-on-surface",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                      )}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </button>
                  </div>
                  <Link
                    href={`/p/${product.slug}`}
                    className="text-body-md font-medium text-on-surface hover:text-primary-container"
                  >
                    {product.displayTitle}
                  </Link>
                  <PriceBlock
                    price={product.price}
                    compareAtPrice={product.compareAtPrice}
                    size="sm"
                  />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {specLabels.map((label) => (
            <tr key={label} className="odd:bg-surface-container-high">
              <th scope="row" className="p-3 text-body-sm font-medium text-on-surface-variant">
                {label}
              </th>
              {products.map((product, columnIndex) => (
                <td key={product.slug} className="p-3 text-body-sm text-on-surface">
                  {/* `columnIndex` comes from this same `products.map(...)` —
                     always in bounds, never arbitrary input. */}
                  {/* eslint-disable-next-line security/detect-object-injection */}
                  {valuesByProduct[columnIndex]?.get(label) ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
