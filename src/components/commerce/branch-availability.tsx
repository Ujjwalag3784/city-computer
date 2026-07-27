import Link from "next/link";
import { CheckCircle2, MapPin, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * BranchAvailability — docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md PDP journey
 * diagram: "price, compare-at, availability, **branch stock**". Shown on a
 * product page so a shopper can see which physical store(s) have it in
 * stock for pickup.
 *
 * Pure presentational list, no local state — a plain function component,
 * no `"use client"` needed. `name`/`address` link to `/stores/[slug]` via
 * `next/link`.
 *
 * In/out-of-stock status is always icon + text together
 * (`CheckCircle2`/`XCircle`), never colour alone (docs/05 §5 A6).
 */
export interface BranchStock {
  name: string;
  address: string;
  /** Links to `/stores/[branchSlug]`. */
  slug: string;
  inStock: boolean;
  quantity?: number;
}

export interface BranchAvailabilityProps {
  branches: BranchStock[];
  className?: string;
}

export function BranchAvailability({ branches, className }: BranchAvailabilityProps) {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <p className="text-body-md text-on-surface">Available at our stores</p>

      {branches.length === 0 ? (
        <p className="text-body-sm text-on-surface-variant">
          Branch availability isn&apos;t available for this product yet.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {branches.map((branch) => (
            <li
              key={branch.slug}
              className="flex items-start justify-between gap-4 border-b border-glass-stroke pb-3 last:border-b-0 last:pb-0"
            >
              <div className="flex items-start gap-2.5">
                <MapPin
                  className="mt-0.5 size-4 shrink-0 text-on-surface-variant"
                  aria-hidden="true"
                />
                <div>
                  <Link
                    href={`/stores/${branch.slug}`}
                    className="rounded text-body-sm font-medium text-on-surface hover:text-primary-container"
                  >
                    {branch.name}
                  </Link>
                  <p className="text-body-sm text-on-surface-variant">{branch.address}</p>
                </div>
              </div>

              {branch.inStock ? (
                <div className="flex shrink-0 items-center gap-1.5 text-body-sm text-on-surface">
                  <CheckCircle2 className="size-4 text-primary-container" aria-hidden="true" />
                  <span>
                    In stock{typeof branch.quantity === "number" ? ` (${branch.quantity})` : ""}
                  </span>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1.5 text-body-sm text-on-surface-variant">
                  <XCircle className="size-4" aria-hidden="true" />
                  <span>Out of stock</span>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
