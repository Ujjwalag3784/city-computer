"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { OrderStatus } from "@/generated/prisma/client";
import { transitionOrderAction } from "../../_actions";
import { ReasonDialog } from "@/components/admin/reason-dialog";

const STATUS_ACTION_LABEL: Partial<Record<OrderStatus, string>> = {
  [OrderStatus.CONFIRMED]: "Confirm order",
  [OrderStatus.PREPARING]: "Start preparing",
  [OrderStatus.PACKED]: "Mark packed",
  [OrderStatus.SHIPPED]: "Mark shipped",
  [OrderStatus.DELIVERED]: "Mark delivered",
  [OrderStatus.COMPLETED]: "Mark completed",
  [OrderStatus.CANCELLED]: "Cancel order",
  [OrderStatus.RETURNED]: "Mark returned",
  [OrderStatus.REFUNDED]: "Mark refunded",
  [OrderStatus.PENDING_PAYMENT]: "Reopen for payment",
};

export interface OrderTransitionPanelProps {
  orderId: string;
  nextStatuses: OrderStatus[];
}

/** The row of "what can happen next" buttons — `nextStatuses` is already filtered server-side (page.tsx) down to what both the state machine *and* this admin's own permissions allow, per docs/09 §8 "never shown-then-denied": a STAFF account never sees a Cancel button it would just get a 403 clicking. */
export function OrderTransitionPanel({ orderId, nextStatuses }: OrderTransitionPanelProps) {
  const router = useRouter();
  const [pendingCancel, setPendingCancel] = useState(false);
  const [submitting, setSubmitting] = useState<OrderStatus | null>(null);

  async function runTransition(to: OrderStatus, note?: string) {
    setSubmitting(to);
    try {
      const result = await transitionOrderAction({ orderId, to, note });
      if (!result.ok) {
        toast(result.message ?? "Couldn't update this order. Please try again.");
        return;
      }
      toast("Order updated.");
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  }

  if (nextStatuses.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {nextStatuses.map((to) =>
        to === OrderStatus.CANCELLED ? (
          <Button
            key={to}
            variant="destructive"
            disabled={submitting !== null}
            onClick={() => setPendingCancel(true)}
          >
            {/* eslint-disable-next-line security/detect-object-injection -- `to` is narrowed to the `OrderStatus` enum, never arbitrary input. */}
            {STATUS_ACTION_LABEL[to] ?? to}
          </Button>
        ) : (
          <Button
            key={to}
            variant="outline"
            disabled={submitting !== null}
            onClick={() => void runTransition(to)}
          >
            {/* eslint-disable-next-line security/detect-object-injection -- `to` is narrowed to the `OrderStatus` enum, never arbitrary input. */}
            {submitting === to ? "Updating…" : (STATUS_ACTION_LABEL[to] ?? to)}
          </Button>
        ),
      )}

      <ReasonDialog
        open={pendingCancel}
        onOpenChange={setPendingCancel}
        title="Cancel this order?"
        description="This tells the shopper their order was cancelled. Stock reservations are released."
        confirmLabel="Yes, cancel it"
        onConfirm={(reason) => runTransition(OrderStatus.CANCELLED, reason)}
      />
    </div>
  );
}
