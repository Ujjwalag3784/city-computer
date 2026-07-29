"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { TicketStatus } from "@/generated/prisma/client";
import { transitionTicketAction } from "../../_actions";

const STATUS_ACTION_LABEL: Partial<Record<TicketStatus, string>> = {
  [TicketStatus.DIAGNOSING]: "Start diagnosing",
  [TicketStatus.QUOTE_SENT]: "Mark quote sent",
  [TicketStatus.AWAITING_APPROVAL]: "Waiting on customer",
  [TicketStatus.APPROVED]: "Customer approved",
  [TicketStatus.DECLINED]: "Customer declined",
  [TicketStatus.IN_REPAIR]: "Start repair",
  [TicketStatus.AWAITING_PARTS]: "Waiting on parts",
  [TicketStatus.READY_FOR_PICKUP]: "Mark ready for pickup",
  [TicketStatus.COLLECTED]: "Mark collected",
  [TicketStatus.CANCELLED]: "Cancel this job",
};

export function TicketTransitionPanel({
  ticketId,
  nextStatuses,
}: {
  ticketId: string;
  nextStatuses: TicketStatus[];
}) {
  const router = useRouter();
  const [pendingCancel, setPendingCancel] = useState(false);
  const [submitting, setSubmitting] = useState<TicketStatus | null>(null);

  async function runTransition(to: TicketStatus, note?: string) {
    setSubmitting(to);
    try {
      const result = await transitionTicketAction({ ticketId, to, note });
      if (!result.ok) {
        toast(result.message ?? "Couldn't update this job. Please try again.");
        return;
      }
      toast("Repair job updated.");
      router.refresh();
    } finally {
      setSubmitting(null);
    }
  }

  if (nextStatuses.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {nextStatuses.map((to) =>
        to === TicketStatus.CANCELLED ? (
          <Button
            key={to}
            variant="destructive"
            disabled={submitting !== null}
            onClick={() => setPendingCancel(true)}
          >
            {/* eslint-disable-next-line security/detect-object-injection -- `to` is narrowed to the `TicketStatus` enum. */}
            {STATUS_ACTION_LABEL[to] ?? to}
          </Button>
        ) : (
          <Button
            key={to}
            variant="outline"
            disabled={submitting !== null}
            onClick={() => void runTransition(to)}
          >
            {/* eslint-disable-next-line security/detect-object-injection -- `to` is narrowed to the `TicketStatus` enum. */}
            {submitting === to ? "Updating…" : (STATUS_ACTION_LABEL[to] ?? to)}
          </Button>
        ),
      )}

      <ReasonDialog
        open={pendingCancel}
        onOpenChange={setPendingCancel}
        title="Cancel this repair job?"
        description="This tells the customer the job was cancelled."
        confirmLabel="Yes, cancel it"
        onConfirm={(reason) => runTransition(TicketStatus.CANCELLED, reason)}
      />
    </div>
  );
}
