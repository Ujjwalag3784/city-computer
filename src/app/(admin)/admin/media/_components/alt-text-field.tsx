"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { updateMediaAltTextAction } from "../_actions";

/**
 * One photo tile's editable "Photo description" (docs/09-ADMIN-DAD-MODE.md
 * §2.1's vocabulary table: never "Alt text") — saves on blur, matching
 * `image-dropzone.tsx`'s description field's own always-editable-inline
 * pattern rather than a separate edit/save mode.
 */
export function AltTextField({ mediaId, initialValue }: { mediaId: string; initialValue: string }) {
  const [value, setValue] = useState(initialValue);
  const [isPending, startTransition] = useTransition();

  function handleBlur() {
    if (value === initialValue) return;
    startTransition(async () => {
      const result = await updateMediaAltTextAction(mediaId, value);
      if (!result.ok) {
        toast(result.message ?? "Couldn't save the photo description.");
      }
    });
  }

  return (
    <Textarea
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onBlur={handleBlur}
      disabled={isPending}
      rows={2}
      placeholder="Photo description"
      aria-label="Photo description"
      className="min-h-0 py-1.5 text-body-sm"
    />
  );
}
