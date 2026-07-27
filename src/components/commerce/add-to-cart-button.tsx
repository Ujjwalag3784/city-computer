"use client";

import * as React from "react";
import { CheckCircle2, Loader2, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * AddToCartButton — docs/05-DESIGN-SYSTEM.md §6 component inventory:
 * "AddToCartButton". Implements the *Optimistic* state model required by
 * §7 "States every component must define": "Add-to-cart and admin status
 * changes update immediately and roll back on failure" — `onAddToCart` is
 * called and, since there's no real cart backend yet, the button itself is
 * the whole optimistic/rollback machine: `idle -> adding -> added -> idle`
 * on success, `adding -> error -> idle` (the "rollback") if the promise
 * rejects. The rejection is always caught locally — never rethrown — so a
 * failing `onAddToCart` cannot produce an unhandled promise rejection here.
 *
 * Per docs/05 §5 A6 ("status never communicated by colour alone") every
 * state pairs an icon (or, for the transient error copy, distinct text)
 * with its label — never a bare colour change on an otherwise-identical
 * button. `outOfStock` always wins over the internal state machine; a
 * generic `disabled` (e.g. "no variant selected yet") only disables the
 * idle button, it doesn't change its label.
 */
export interface AddToCartButtonProps {
  onAddToCart: () => void | Promise<void>;
  disabled?: boolean;
  outOfStock?: boolean;
  className?: string;
}

type AddToCartState = "idle" | "adding" | "added" | "error";

const ADDED_DISPLAY_MS = 1500;
const ERROR_DISPLAY_MS = 1500;

export function AddToCartButton({
  onAddToCart,
  disabled = false,
  outOfStock = false,
  className,
}: AddToCartButtonProps) {
  const [state, setState] = React.useState<AddToCartState>("idle");
  const resetTimeout = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(
    () => () => {
      if (resetTimeout.current) clearTimeout(resetTimeout.current);
    },
    [],
  );

  const scheduleReset = (delayMs: number) => {
    if (resetTimeout.current) clearTimeout(resetTimeout.current);
    resetTimeout.current = setTimeout(() => setState("idle"), delayMs);
  };

  const handleClick = async () => {
    if (state === "adding") return;
    setState("adding");
    try {
      await onAddToCart();
      setState("added");
      scheduleReset(ADDED_DISPLAY_MS);
    } catch {
      // Rollback: the optimistic "adding" never committed, fall back to a
      // visible error state instead of silently returning to idle.
      setState("error");
      scheduleReset(ERROR_DISPLAY_MS);
    }
  };

  if (outOfStock) {
    return (
      <Button type="button" variant="outline" disabled className={cn(className)}>
        Out of stock
      </Button>
    );
  }

  const isAdding = state === "adding";

  return (
    <Button
      type="button"
      variant="primary"
      glow={state === "idle"}
      onClick={handleClick}
      disabled={disabled || isAdding}
      aria-live="polite"
      className={cn(className)}
    >
      {state === "adding" && (
        <>
          <Loader2 className="animate-spin" aria-hidden="true" />
          Adding...
        </>
      )}
      {state === "added" && (
        <>
          <CheckCircle2 aria-hidden="true" />
          Added to cart
        </>
      )}
      {state === "error" && "Couldn't add — try again"}
      {state === "idle" && (
        <>
          <ShoppingCart aria-hidden="true" />
          Add to cart
        </>
      )}
    </Button>
  );
}
