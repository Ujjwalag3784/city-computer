"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReasonDialog } from "@/components/admin/reason-dialog";
import { setCustomerCodBlockedAction } from "../../_actions";

export interface CodBlockToggleProps {
  customerId: string;
  codBlocked: boolean;
  canUpdate: boolean;
}

/**
 * docs/10-PAYMENTS-NEPAL.md §7's "Repeat-refusal blocklist" toggle — the
 * one control on this page that actually changes whether
 * `commerce/payments/cod.ts` will let this customer place a Cash on
 * Delivery order. A reason is required in both directions (see
 * `admin/customers.ts`'s own doc comment on why lifting a block also
 * needs one), matching docs/09 §8's "reason required on every change".
 */
export function CodBlockToggle({ customerId, codBlocked, canUpdate }: CodBlockToggleProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirm(reason: string) {
    setSubmitting(true);
    try {
      const result = await setCustomerCodBlockedAction({
        customerId,
        blocked: !codBlocked,
        reason,
      });
      if (!result.ok) {
        toast(result.message ?? "Couldn't update this customer. Please try again.");
        return;
      }
      toast(
        codBlocked
          ? "Cash on Delivery is allowed for this customer again."
          : "This customer can no longer pay Cash on Delivery.",
      );
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  if (!canUpdate) {
    return (
      <p className="text-body-sm text-on-surface-variant">
        {codBlocked
          ? "Cash on Delivery is blocked for this customer."
          : "Cash on Delivery is allowed for this customer."}
      </p>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant={codBlocked ? "outline" : "destructive"}
        disabled={submitting}
        onClick={() => setOpen(true)}
      >
        {codBlocked ? "Allow Cash on Delivery again" : "Block Cash on Delivery"}
      </Button>
      <ReasonDialog
        open={open}
        onOpenChange={setOpen}
        title={
          codBlocked ? "Allow Cash on Delivery again?" : "Block Cash on Delivery for this customer?"
        }
        description={
          codBlocked
            ? "They'll be able to choose Cash on Delivery at checkout again."
            : "They won't be able to choose Cash on Delivery at checkout until you allow it again."
        }
        confirmLabel={codBlocked ? "Yes, allow it" : "Yes, block it"}
        onConfirm={handleConfirm}
      />
    </>
  );
}
