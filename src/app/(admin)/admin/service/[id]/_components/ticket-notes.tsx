"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateTicketNotesAction } from "../../_actions";

export function TicketNotes({
  ticketId,
  initialNotes,
}: {
  ticketId: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const dirty = notes !== (initialNotes ?? "");

  async function handleSave() {
    setSaving(true);
    try {
      const result = await updateTicketNotesAction({ ticketId, internalNotes: notes });
      if (!result.ok) {
        toast(result.message ?? "Couldn't save this note.");
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
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Diagnosis details, parts ordered, anything the next technician should know..."
        rows={4}
      />
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
    </div>
  );
}
