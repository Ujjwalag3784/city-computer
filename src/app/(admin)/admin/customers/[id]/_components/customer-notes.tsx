"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateCustomerNotesAction } from "../../_actions";

export interface CustomerNotesProps {
  customerId: string;
  initialNotes: string | null;
  canUpdate: boolean;
}

/**
 * docs/09-ADMIN-DAD-MODE.md §7's "Customer panel... and any internal
 * notes" — a single free-text field (`Customer.notes`), not a threaded
 * comment list (see `admin/customers.ts`'s doc comment on why). Every
 * save overwrites the field and is recorded in Activity History.
 */
export function CustomerNotes({ customerId, initialNotes, canUpdate }: CustomerNotesProps) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = notes !== (initialNotes ?? "");

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateCustomerNotesAction({ customerId, notes });
      if (!result.ok) {
        toast(result.message ?? "Couldn't save this note. Please try again.");
        return;
      }
      toast("Note saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        value={notes}
        onChange={(event) => setNotes(event.target.value)}
        placeholder="Anything your team should know about this customer — e.g. prefers phone calls, always pays in shop."
        disabled={!canUpdate}
        rows={4}
      />
      {canUpdate && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="self-end"
          disabled={!dirty || saving}
          onClick={() => void handleSave()}
        >
          {saving ? "Saving…" : "Save note"}
        </Button>
      )}
    </div>
  );
}
