"use client";

import { AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * ConfirmDialog — docs/09-ADMIN-DAD-MODE.md §8 "Error prevention" table:
 *
 *   | Deleting a product     | Products are hidden, never deleted, if they
 *                              have any order history. The confirm dialog
 *                              names the product and requires typing
 *                              nothing — just an explicit "Yes, hide it" —
 *                              and states "You can bring it back any
 *                              time."
 *   | Deleting anything else | Two-step confirm naming the item and its
 *                              consequences. Destructive buttons are red,
 *                              secondary, and never adjacent to a primary
 *                              action.
 *
 * `variant="hide"` covers the first row: the reassurance line "You can
 * bring it back any time." is hardcoded (not a caller-supplied prop),
 * since it's a fixed trust guarantee the doc states verbatim, not
 * per-caller copy. `variant="destructive"` covers the second row.
 *
 * Layout choice for "never adjacent to a primary action": the footer is
 * `justify-between` (not the shared `DialogFooter`'s default
 * `flex-col-reverse ... sm:justify-end`, which clusters both actions
 * together on the right and, via `flex-col-reverse`, would put the red
 * action visually *above* Cancel when stacked on mobile — the opposite of
 * what we want). Cancel renders first in DOM and reading order — the
 * left/top, more prominent, default-focused slot — with the red confirm
 * action pushed to the opposite end and a full flex gap between them, so
 * the two are never equal-weight, touching siblings a misclick could hit
 * interchangeably. Both buttons are full-width and stacked on narrow
 * screens (Cancel still on top) per docs/09 §11 "Mobile ... optimised for
 * one thumb".
 *
 * `"use client"`: Radix `Dialog` state plus button handlers.
 */
export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  itemName: string;
  consequence?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  variant?: "hide" | "destructive";
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  itemName,
  consequence,
  confirmLabel,
  onConfirm,
  variant = "destructive",
}: ConfirmDialogProps) {
  const isHide = variant === "hide";
  const label = confirmLabel ?? (isHide ? "Yes, hide it" : "Yes, delete it");

  const handleConfirm = () => {
    onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-on-surface-variant" aria-hidden="true" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-body-md font-medium text-on-surface">
            “{itemName}”
          </DialogDescription>
        </DialogHeader>

        {(consequence || isHide) && (
          <div className="flex flex-col gap-2">
            {consequence && <p className="text-body-sm text-on-surface-variant">{consequence}</p>}
            {isHide && (
              <p className="text-body-sm text-on-surface-variant">
                You can bring it back any time.
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-4 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="w-full sm:w-auto"
            onClick={handleConfirm}
          >
            {label}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
