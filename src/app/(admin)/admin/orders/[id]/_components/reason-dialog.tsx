"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/**
 * A small text-reason confirm dialog — `@/components/admin/confirm-dialog.tsx`'s
 * `ConfirmDialog` covers the fixed-copy "yes/no" cases (docs/09 §8), but
 * cancelling an order or rejecting a bank-transfer payment both need a
 * free-text reason recorded alongside the action (`Order.cancellationReason`,
 * `Payment.rejectionReason`) — this is that missing shape, kept local to
 * `/admin/orders` rather than promoted to `components/admin/` on its first
 * use (same "promote on second consumer" rule `admin-search-box.tsx`'s own
 * doc comment states).
 */
export interface ReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel: string;
  requireReason?: boolean;
  onConfirm: (reason: string) => void | Promise<void>;
}

export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  requireReason = true,
  onConfirm,
}: ReasonDialogProps) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm() {
    if (requireReason && reason.trim() === "") return;
    setSubmitting(true);
    try {
      await onConfirm(reason.trim());
      setReason("");
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reason-dialog-textarea">Reason</Label>
          <Textarea
            id="reason-dialog-textarea"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Why?"
          />
        </div>

        <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={() => void handleConfirm()}
            disabled={submitting || (requireReason && reason.trim() === "")}
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
