"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNPR } from "@/lib/money";
import type { AdminOrderDetailPayment } from "@/server/services/admin/orders";
import {
  markCodCollectedAction,
  approveBankTransferAction,
  rejectBankTransferAction,
  getReceiptViewUrlAction,
} from "../../_actions";
import { ReasonDialog } from "@/components/admin/reason-dialog";

export interface PaymentPanelProps {
  orderId: string;
  payment: AdminOrderDetailPayment;
  canUpdate: boolean;
  canApprovePayment: boolean;
}

const PAYMENT_STATUS_VARIANT: Record<
  string,
  "primary" | "success" | "warning" | "danger" | "glass"
> = {
  INITIATED: "glass",
  PENDING: "warning",
  PAID: "success",
  FAILED: "danger",
  REFUNDED: "glass",
};

/** COD or Bank Transfer — the two rails this pass built (`payments/cod.ts`, `payments/bank-transfer.ts`). A future eSewa/Khalti/Fonepay/connectIPS payment would need its own branch here (not built this pass). */
export function PaymentPanel({
  orderId,
  payment,
  canUpdate,
  canApprovePayment,
}: PaymentPanelProps) {
  const router = useRouter();
  const [pendingReject, setPendingReject] = useState(false);
  const [busy, setBusy] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState(false);

  async function handleMarkCollected() {
    setBusy(true);
    try {
      const result = await markCodCollectedAction(payment.id, orderId);
      if (!result.ok) {
        toast(result.message ?? "Couldn't mark this as collected. Please try again.");
        return;
      }
      toast("Marked as collected.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleViewReceipt() {
    setViewingReceipt(true);
    try {
      const result = await getReceiptViewUrlAction(payment.receiptMediaId as string);
      if (!result.ok || !result.data) {
        toast(result.message ?? "Couldn't open the receipt. Please try again.");
        return;
      }
      window.open(result.data.url, "_blank", "noopener,noreferrer");
    } finally {
      setViewingReceipt(false);
    }
  }

  async function handleApprove() {
    setBusy(true);
    try {
      const result = await approveBankTransferAction(payment.id, orderId);
      if (!result.ok) {
        toast(result.message ?? "Couldn't approve this payment. Please try again.");
        return;
      }
      toast("Payment approved. The order has been confirmed.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleReject(reason: string) {
    const result = await rejectBankTransferAction({ paymentId: payment.id, reason }, orderId);
    if (!result.ok) {
      toast(result.message ?? "Couldn't reject this payment. Please try again.");
      return;
    }
    toast("Payment rejected.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-body-md text-on-surface">
          {payment.provider === "COD" ? "Cash on Delivery" : "Bank Transfer"} —{" "}
          {formatNPR(payment.amountPaisa)}
        </span>
        <Badge variant={PAYMENT_STATUS_VARIANT[payment.status] ?? "glass"}>{payment.status}</Badge>
      </div>

      {payment.rejectionReason && (
        <p className="text-body-sm text-on-surface-variant">Rejected: {payment.rejectionReason}</p>
      )}

      {payment.provider === "COD" && payment.status === "PENDING" && canUpdate && (
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          disabled={busy}
          onClick={() => void handleMarkCollected()}
        >
          Mark cash collected
        </Button>
      )}

      {payment.provider === "BANK_TRANSFER" && (
        <div className="flex flex-wrap gap-2">
          {payment.receiptMediaId && (
            <Button
              variant="outline"
              disabled={viewingReceipt}
              onClick={() => void handleViewReceipt()}
            >
              {viewingReceipt ? "Opening…" : "View receipt"}
            </Button>
          )}
          {payment.status === "PENDING" && payment.receiptMediaId && canApprovePayment && (
            <>
              <Button variant="primary" glow disabled={busy} onClick={() => void handleApprove()}>
                Approve
              </Button>
              <Button variant="destructive" disabled={busy} onClick={() => setPendingReject(true)}>
                Reject
              </Button>
            </>
          )}
          {payment.status === "PENDING" && !payment.receiptMediaId && (
            <p className="text-body-sm text-on-surface-variant">
              Waiting for the customer to upload a receipt.
            </p>
          )}
        </div>
      )}

      <ReasonDialog
        open={pendingReject}
        onOpenChange={setPendingReject}
        title="Reject this payment?"
        description="The shopper will be asked to try again or use a different payment method."
        confirmLabel="Reject payment"
        onConfirm={handleReject}
      />
    </div>
  );
}
