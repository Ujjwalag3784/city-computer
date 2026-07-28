"use client";

import { AlertTriangle, Check, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * PublishChecklist — docs/09-ADMIN-DAD-MODE.md §5.1 "Publishing":
 * "'Publish' runs a readiness check and, if anything is missing, shows a
 * checklist rather than blocking":
 *
 * ```
 *   Before publishing:
 *   ✓ Name and price
 *   ✓ Category
 *   ✗ No photos yet          — customers rarely buy products without photos
 *   ✓ Details filled in
 *   ⚠ Search description is a bit short
 *
 *   [ Publish anyway ]   [ Go back and fix ]
 * ```
 *
 * `product-wizard.tsx` only opens this dialog when the readiness check
 * comes back with something not fully "ok" — when everything's fine it
 * publishes immediately without showing a checklist at all, matching the
 * doc's own "if anything is missing" framing rather than always
 * interrupting a clean publish with an all-green dialog nobody needs to
 * read.
 *
 * Deliberately not `components/ui/`: this is one specific screen's
 * dialog (docs/05-DESIGN-SYSTEM.md §7's "Checklists" pattern applied to
 * exactly one use), not a generic primitive other admin screens would
 * reuse as-is the way `ConfirmDialog` is.
 *
 * Local `PublishChecklistItem`/`status` shape mirrors `server/services/
 * admin/product.ts`'s `PublishReadinessItem`/`ReadinessStatus` structurally
 * rather than importing them — this file lives in `components/admin/`,
 * which must not import from `server/**` (docs/04 §3).
 */
export type PublishChecklistStatus = "ok" | "missing" | "warning";
export interface PublishChecklistItem {
  id: string;
  label: string;
  status: PublishChecklistStatus;
}

export interface PublishChecklistProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: PublishChecklistItem[];
  onPublishAnyway: () => void;
  isPublishing?: boolean;
}

function ItemIcon({ status }: { status: PublishChecklistStatus }) {
  if (status === "ok") return <Check className="size-4 shrink-0 text-success" aria-hidden="true" />;
  if (status === "missing") return <X className="size-4 shrink-0 text-danger" aria-hidden="true" />;
  return <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden="true" />;
}

export function PublishChecklist({
  open,
  onOpenChange,
  items,
  onPublishAnyway,
  isPublishing = false,
}: PublishChecklistProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Before publishing</DialogTitle>
        </DialogHeader>

        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2 text-body-sm text-on-surface">
              <ItemIcon status={item.status} />
              <span
                className={cn(
                  item.status === "missing" && "text-danger",
                  item.status === "warning" && "text-warning",
                )}
              >
                {item.label}
              </span>
            </li>
          ))}
        </ul>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Go back and fix
          </Button>
          <Button type="button" variant="primary" disabled={isPublishing} onClick={onPublishAnyway}>
            {isPublishing ? "Publishing…" : "Publish anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
