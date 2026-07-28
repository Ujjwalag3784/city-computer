"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * BuildShareDialog — docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md §4.2 Step 10
 * "Review": "Save (autosaved already) ──► `/build/a7Kd93Xq` (shareable;
 * noindex by default)". This is what `BuildSummaryPanel`'s "Share" button
 * opens into (the page wires `BuildSummaryPanel`'s `onShare` to flip this
 * dialog's `open` — this component doesn't know about that panel at all).
 *
 * "noindex by default" is a technical detail about the page's
 * `<meta name="robots">` tag, never surfaced to the customer verbatim per
 * docs/08-PC-BUILDER-ENGINE.md §1 principle 8 ("Explain in plain language" —
 * "Not 'GPU_LENGTH_CONSTRAINT_VIOLATION'"); the note below the input
 * renders the plain-language consequence instead: "This link is public but
 * won't appear in search results."
 *
 * Built on the real `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`
 * composition from `src/components/ui/dialog.tsx` (Radix under the hood,
 * per docs/05-DESIGN-SYSTEM.md §5 A5's "composite widgets must use Radix,
 * never hand-rolled"); `DialogContent` already renders its own labelled
 * close button, so this component only needs to supply the title and body.
 *
 * `"use client"`: the copy-to-clipboard interaction and the local "copied"
 * feedback state can only exist in a Client Component. `navigator.clipboard
 * .writeText` is wrapped in try/catch because it can reject in some
 * contexts (no HTTPS/permission, an iframe, an older browser) — on failure
 * this falls back to visibly selecting the input's text so the shopper can
 * still copy manually via Ctrl+C, with a small note calling that out.
 */
export interface BuildShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareUrl: string;
  className?: string;
}

const COPIED_FEEDBACK_MS = 2000;

export function BuildShareDialog({
  open,
  onOpenChange,
  shareUrl,
  className,
}: BuildShareDialogProps) {
  const [copyState, setCopyState] = React.useState<"idle" | "copied" | "failed">("idle");
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Reset the transient feedback whenever the dialog is reopened or the link
  // changes, so a stale "Copied!" from a previous open never lingers.
  React.useEffect(() => {
    setCopyState("idle");
  }, [open, shareUrl]);

  React.useEffect(() => {
    if (copyState !== "copied") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), COPIED_FEEDBACK_MS);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("copied");
    } catch {
      inputRef.current?.select();
      setCopyState("failed");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn(className)}>
        <DialogHeader>
          <DialogTitle>Share your build</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              type="text"
              readOnly
              value={shareUrl}
              aria-label="Shareable build link"
              onFocus={(event) => event.currentTarget.select()}
              className="flex-1"
            />
            <Button type="button" variant="outline" size="md" onClick={() => void handleCopy()}>
              {copyState === "copied" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copyState === "copied" ? "Copied!" : "Copy"}
            </Button>
          </div>

          {copyState === "failed" && (
            <p role="alert" className="text-body-sm text-on-surface-variant">
              Couldn&apos;t copy automatically — press Ctrl+C to copy.
            </p>
          )}

          <p className="text-body-sm text-on-surface-variant">
            This link is public but won&apos;t appear in search results.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
