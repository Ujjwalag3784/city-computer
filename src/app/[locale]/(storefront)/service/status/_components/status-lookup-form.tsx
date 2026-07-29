"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatRelativeTime } from "@/lib/date";
import type { PublicTicketStatus } from "@/server/services/service/public-tickets";
import { lookupTicketStatusAction } from "../_actions";

/** Same local title-case helper used by `admin/service/[id]/_components/ticket-timeline.tsx` and `admin/orders/[id]/_components/order-timeline.tsx` — this codebase keeps this as a small per-file helper rather than a shared util (see those files; not refactored here to stay in scope for Phase 10). */
function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

export interface StatusLookupFormProps {
  initialTicketNumber?: string;
}

/**
 * `/service/status`'s interactive half. The ticket number may be prefilled
 * (e.g. the booking form links here with `?ticketNumber=...` right after
 * booking) but the phone digits are always required and never prefilled —
 * a prefilled ticket number alone still can't unlock anything, matching
 * `getPublicTicketStatus`'s enumeration-resistant gate.
 */
export function StatusLookupForm({ initialTicketNumber }: StatusLookupFormProps) {
  const [ticketNumber, setTicketNumber] = useState(initialTicketNumber ?? "");
  const [phoneLastFour, setPhoneLastFour] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<PublicTicketStatus | null>(null);

  async function handleSubmit() {
    setError(null);
    setChecking(true);
    try {
      const response = await lookupTicketStatusAction({ ticketNumber, phoneLastFour });
      if (!response.ok || !response.data) {
        setError(response.message ?? "We couldn't find a matching repair ticket.");
        return;
      }
      setResult(response.data);
    } finally {
      setChecking(false);
    }
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4 rounded-lg border border-glass-stroke p-6">
        <div>
          <p className="text-label-mono-xs text-on-surface-variant">Ticket {result.ticketNumber}</p>
          <p className="text-headline-sm text-on-surface">{statusLabel(result.status)}</p>
        </div>
        <p className="text-body-sm text-on-surface-variant">
          {result.brand} {result.deviceType.toLowerCase()}
          {result.model ? ` — ${result.model}` : ""}
        </p>
        <p className="text-body-sm text-on-surface-variant">
          {result.branchName} — {result.branchAddress}
        </p>
        {result.estimatedReadyAt && (
          <p className="text-body-sm text-on-surface-variant">
            Estimated ready: {formatRelativeTime(result.estimatedReadyAt)}
          </p>
        )}
        {result.events.length > 0 && (
          <ul className="flex flex-col gap-2 border-t border-glass-stroke pt-3">
            {result.events.map((event, index) => (
              <li
                key={`${event.toStatus}-${index}`}
                className="flex flex-col gap-0.5 border-l-2 border-glass-stroke pl-3"
              >
                <p className="text-body-sm text-on-surface">
                  {statusLabel(event.toStatus)}
                  {event.note ? ` — ${event.note}` : ""}
                </p>
                <time
                  dateTime={event.createdAt.toISOString()}
                  className="text-label-mono-xs text-on-surface-variant"
                >
                  {formatRelativeTime(event.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        )}
        <Button variant="outline" onClick={() => setResult(null)} className="self-start">
          Check another ticket
        </Button>
      </div>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status-ticket-number">Ticket number</Label>
        <Input
          id="status-ticket-number"
          value={ticketNumber}
          onChange={(e) => setTicketNumber(e.target.value)}
          placeholder="SVC-2607-0042"
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="status-phone-last-four">Last 4 digits of your phone number</Label>
        <Input
          id="status-phone-last-four"
          value={phoneLastFour}
          onChange={(e) => setPhoneLastFour(e.target.value)}
          maxLength={4}
          inputMode="numeric"
          placeholder="0001"
        />
      </div>
      <Button
        variant="primary"
        disabled={checking || !ticketNumber || phoneLastFour.length !== 4}
        onClick={() => void handleSubmit()}
      >
        {checking ? "Checking…" : "Check status"}
      </Button>
    </div>
  );
}
