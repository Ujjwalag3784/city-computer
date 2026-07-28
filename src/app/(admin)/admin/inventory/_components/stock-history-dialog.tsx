"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatKathmanduDateTime } from "@/lib/date";
import { getStockHistoryAction } from "../_actions";
import type { StockHistoryEntry } from "@/server/services/admin/inventory";

/**
 * docs/09-ADMIN-DAD-MODE.md §6 "Stock history": "Per product: a plain-
 * language timeline. '27 Jul, 10:14 — Ramesh added 5 (Received new
 * stock). Now 12.'" Loads on open rather than being passed data — this
 * dialog is mounted once per row and only fetches once the owner
 * actually asks to see a given product's history.
 */
export function StockHistoryDialog({
  open,
  onOpenChange,
  variantId,
  productName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  variantId: string;
  productName: string;
}) {
  const [entries, setEntries] = useState<StockHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setEntries(null);
      setError(null);
      return;
    }
    getStockHistoryAction(variantId).then((result) => {
      if (!result.ok || !result.data) {
        setError(result.message ?? "Couldn't load the stock history.");
        return;
      }
      setEntries(result.data.items);
    });
  }, [open, variantId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Stock history — {productName}</DialogTitle>
        </DialogHeader>

        {error && <p className="text-body-sm text-error">{error}</p>}
        {!error && entries === null && (
          <p className="text-body-sm text-on-surface-variant">Loading…</p>
        )}
        {!error && entries !== null && entries.length === 0 && (
          <p className="text-body-sm text-on-surface-variant">No stock changes recorded yet.</p>
        )}
        {!error && entries !== null && entries.length > 0 && (
          <ul className="flex max-h-96 flex-col gap-3 overflow-y-auto">
            {entries.map((entry) => (
              <li key={entry.id} className="text-body-sm text-on-surface">
                <span className="text-on-surface-variant">
                  {formatKathmanduDateTime(entry.createdAt)}
                </span>
                {" — "}
                <span className="font-medium">{entry.actorLabel}</span>{" "}
                {entry.delta >= 0 ? `added ${entry.delta}` : `removed ${Math.abs(entry.delta)}`} (
                {entry.reasonLabel}). Now {entry.quantityAfter}.
              </li>
            ))}
          </ul>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
