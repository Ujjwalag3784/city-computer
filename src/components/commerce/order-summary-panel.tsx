"use client";

import * as React from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { formatNPR } from "@/lib/money";
import { cn } from "@/lib/utils";

/**
 * OrderSummaryPanel — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "OrderSummaryPanel". The "4" side of the cart page's §8 "Cart: 8/4 split:
 * line items ‖ sticky summary", and reused as-is on the checkout page's
 * matching 8/4 split per the same section.
 *
 * `"use client"`: the coupon row needs local state for the input's
 * uncommitted draft value before submit (same "editable draft synced from
 * the last-committed prop" idiom as `QuantityStepper`'s `draft`) — nothing
 * else here needs a client boundary, but that alone requires the directive.
 *
 * Sticky positioning is deliberately NOT baked in here — the cart page and
 * checkout page may want different sticky offsets (`lg:sticky lg:top-24` vs.
 * whatever the checkout layout needs), so that's the page's job via
 * `className`, per the constraint that this component only owns its own
 * surface, not where the page anchors it.
 *
 * Money props are all integer paisa (docs/06-DATA-MODEL.md §4), formatted
 * only at render via `formatNPR`. `discount`/`shipping` follow `PriceBlock`'s
 * own idiom of narrowing an optional prop through a single nullable local
 * rather than a separate boolean flag: `discount` only renders (in
 * `text-success`, still with a leading `-` per §5 A6 "never colour alone")
 * when greater than 0; `shipping` renders "Calculated at checkout" in muted
 * text when omitted entirely — the cart page won't know the delivery-zone
 * fee yet, the checkout page will (docs/02 §2.2: "Inside Valley NPR 150 /
 * Outside NPR 350"), and this component stays generic to both rather than
 * hardcoding either zone's fee. `taxInclusiveNote` renders a "VAT included"
 * line per docs/02 §2.2's inclusive-display rule (the price shown already
 * includes the 13% VAT — no separate "+ tax" line is ever added on top).
 *
 * Coupon: only rendered when `onApplyCoupon` is passed. There is no separate
 * "remove coupon" callback in the prop contract, so removing an applied
 * coupon reuses `onApplyCoupon` with an empty string — the caller is
 * expected to treat that as "clear the coupon", keeping the callback surface
 * to one function. Applying is a two-mode `await`-in-`try/catch` (same
 * pattern as `NewsletterForm`/`StockAlertForm`): success is signalled by the
 * caller updating `couponCode`, a rejection shows an inline `role="alert"`
 * error and leaves the draft editable to retry.
 *
 * `primaryAction` is an opaque `ReactNode` slot (e.g. "Proceed to checkout"
 * on the cart page, "Place order" on checkout) — this component never
 * hardcodes either page's wording or behaviour.
 */
export interface OrderSummaryPanelProps {
  /** Integer paisa. */
  subtotal: number;
  /** Integer paisa. Only rendered when greater than 0. */
  discount?: number;
  /** Integer paisa. Renders "Calculated at checkout" in muted text when omitted. */
  shipping?: number;
  /** Integer paisa. */
  total: number;
  /** Already-applied coupon code, if any — shown as an applied chip instead of the input. */
  couponCode?: string;
  /** Called with the entered code to apply, or `""` to clear an applied coupon. */
  onApplyCoupon?: (code: string) => void | Promise<void>;
  /** Shows a "VAT included" note under the total, per docs/02 §2.2. */
  taxInclusiveNote?: boolean;
  /** Page-specific CTA slot, e.g. "Proceed to checkout" or "Place order". */
  primaryAction?: React.ReactNode;
  className?: string;
}

export function OrderSummaryPanel({
  subtotal,
  discount,
  shipping,
  total,
  couponCode,
  onApplyCoupon,
  taxInclusiveNote = false,
  primaryAction,
  className,
}: OrderSummaryPanelProps) {
  const [draftCode, setDraftCode] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "applying" | "error">("idle");

  // Whenever the committed coupon changes from outside (applied, cleared, or
  // reset after a failed order), drop any stale draft text and error state —
  // same reasoning as `QuantityStepper` re-syncing its `draft` from `value`.
  React.useEffect(() => {
    setDraftCode("");
    setStatus("idle");
  }, [couponCode]);

  // Narrow through a single nullable local rather than a separate boolean
  // flag, matching `PriceBlock`'s own `compareAt` idiom.
  const discountPaisa = typeof discount === "number" && discount > 0 ? discount : null;
  const shippingPaisa = typeof shipping === "number" ? shipping : null;

  async function applyCode(code: string) {
    if (!onApplyCoupon) return;
    setStatus("applying");
    try {
      await onApplyCoupon(code);
      setStatus("idle");
    } catch {
      setStatus("error");
    }
  }

  return (
    <Card
      variant="surface"
      className={cn(
        "transition-all duration-300 hover:border-primary-container/40 hover:shadow-glow/30",
        className,
      )}
    >
      {/* `CardContent` defaults to `pt-0` (it expects a `CardHeader` above it
          for the top gap) — there is no header here, so `pt-[--space-card-
          padding]` is restored via `className`, which `cn`'s `twMerge` lets
          win over the base `pt-0`. */}
      <CardContent className="flex flex-col gap-4 pt-[--space-card-padding]">
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between text-body-md text-on-surface">
            <span>Subtotal</span>
            <span>{formatNPR(subtotal)}</span>
          </div>

          {discountPaisa !== null && (
            <div className="flex items-baseline justify-between text-body-md text-success">
              <span>Discount</span>
              <span>-{formatNPR(discountPaisa)}</span>
            </div>
          )}

          <div className="flex items-baseline justify-between text-body-md">
            <span className="text-on-surface">Shipping</span>
            {shippingPaisa !== null ? (
              <span className="text-on-surface">{formatNPR(shippingPaisa)}</span>
            ) : (
              <span className="text-on-surface-variant">Calculated at checkout</span>
            )}
          </div>
        </div>

        <Separator />

        <div className="flex flex-col gap-1">
          <div className="flex items-baseline justify-between">
            <span className="text-body-md font-medium text-on-surface">Total</span>
            <span className="text-price-lg text-on-surface">{formatNPR(total)}</span>
          </div>
          {taxInclusiveNote && <p className="text-body-sm text-on-surface-variant">VAT included</p>}
        </div>

        {onApplyCoupon && (
          <div className="flex flex-col gap-2 border-t border-glass-stroke pt-4">
            {couponCode ? (
              <div className="flex items-center justify-between gap-2 rounded border border-glass-stroke bg-surface-container-high px-3 py-2">
                <span className="flex items-center gap-2 text-body-sm text-on-surface">
                  <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
                  Coupon applied: {couponCode}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="md"
                  iconOnly
                  aria-label="Remove coupon"
                  disabled={status === "applying"}
                  onClick={() => void applyCode("")}
                  className="shrink-0 text-on-surface-variant hover:text-error"
                >
                  <X aria-hidden="true" />
                </Button>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  const trimmed = draftCode.trim();
                  if (trimmed.length > 0) void applyCode(trimmed);
                }}
                className="flex gap-2"
              >
                <Input
                  type="text"
                  placeholder="Coupon code"
                  aria-label="Coupon code"
                  value={draftCode}
                  onChange={(event) => setDraftCode(event.target.value)}
                  disabled={status === "applying"}
                  className="flex-1"
                />
                <Button
                  type="submit"
                  variant="outline"
                  size="sm"
                  disabled={status === "applying" || draftCode.trim().length === 0}
                >
                  {status === "applying" ? (
                    <Loader2 className="animate-spin" aria-hidden="true" />
                  ) : (
                    "Apply"
                  )}
                </Button>
              </form>
            )}
            {status === "error" && (
              <p role="alert" className="text-body-sm text-error">
                Couldn&apos;t apply that code — try again.
              </p>
            )}
          </div>
        )}

        {primaryAction && <div className="pt-2">{primaryAction}</div>}
      </CardContent>
    </Card>
  );
}
