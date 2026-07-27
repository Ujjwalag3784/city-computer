import { X } from "lucide-react";
import { StepperNav, type StepperStep } from "@/components/commerce/stepper-nav";
import { cn } from "@/lib/utils";

/**
 * OrderStatusTracker — docs/06-DATA-MODEL.md §6.1 order state machine:
 *
 *   PENDING_PAYMENT ─┬─► CONFIRMED ─► PREPARING ─► PACKED ─► SHIPPED ─► DELIVERED ─► COMPLETED
 *                    └──────────► CANCELLED (from any pre-SHIPPED state)
 *
 * The full backend enum has more states than a customer needs surfaced as
 * distinct milestones. `OrderVisibleStatus` is the customer-facing
 * simplification this component actually renders, and the mapping a caller
 * (a later order-detail integration phase) must use to go from a real
 * `Order.status` to this component's `status` prop is:
 *
 *   PENDING_PAYMENT -> "placed"     (order exists, payment not yet settled)
 *   CONFIRMED        -> "confirmed" (payment received — docs/06 status table)
 *   PREPARING        -> "confirmed" (sub-state of "being prepared", folded into
 *                                    the "confirmed" milestone — no separate
 *                                    visible step; a customer doesn't need to
 *                                    distinguish "confirmed" from "preparing")
 *   PACKED           -> "packed"
 *   SHIPPED          -> "shipped"   (label "Sent" in the status table)
 *   DELIVERED        -> "delivered"
 *   COMPLETED        -> "delivered" (terminal success state folds into the
 *                                    last visible milestone — "Done" reads as
 *                                    the same customer-facing moment as
 *                                    "Delivered", just after any post-delivery
 *                                    admin closeout)
 *   CANCELLED         -> "cancelled" (own dedicated banner, see below)
 *
 * Every status up to and including the current one renders `"complete"`
 * except the current one itself, which renders `"current"`; everything
 * after renders `"upcoming"` — ordinary linear-stepper semantics, delegated
 * entirely to `StepperNav` (itself not a client component, so this wrapper
 * doesn't need `"use client"` either).
 *
 * `"cancelled"` is deliberately NOT rendered as a stepper with some steps
 * complete and the rest skipped — this component only receives the terminal
 * `"cancelled"` status, not *which* pre-SHIPPED state the order was
 * cancelled from, so there is no correct point to freeze the progression at.
 * A plain, neutral-toned banner ("This order was cancelled.") is the
 * simplest accurate representation: cancellation is a known, completed
 * outcome, not an in-progress error, so it intentionally avoids `text-error`/
 * red treatments in favour of the same muted surface tokens used for
 * "upcoming" steps.
 */
export type OrderVisibleStatus =
  | "placed"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled";

export interface OrderStatusTrackerProps {
  status: OrderVisibleStatus;
  className?: string;
}

const MILESTONES: { status: Exclude<OrderVisibleStatus, "cancelled">; label: string }[] = [
  { status: "placed", label: "Placed" },
  { status: "confirmed", label: "Confirmed" },
  { status: "packed", label: "Packed" },
  { status: "shipped", label: "Shipped" },
  { status: "delivered", label: "Delivered" },
];

export function OrderStatusTracker({ status, className }: OrderStatusTrackerProps) {
  if (status === "cancelled") {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-xl border border-glass-stroke bg-surface-container-high p-4 text-on-surface",
          className,
        )}
      >
        <X className="size-4 text-on-surface-variant" aria-hidden="true" />
        <p className="text-body-sm">This order was cancelled.</p>
      </div>
    );
  }

  const currentIndex = MILESTONES.findIndex((milestone) => milestone.status === status);

  const steps: StepperStep[] = MILESTONES.map((milestone, index) => ({
    label: milestone.label,
    status: index < currentIndex ? "complete" : index === currentIndex ? "current" : "upcoming",
  }));

  return <StepperNav steps={steps} orientation="horizontal" className={className} />;
}
