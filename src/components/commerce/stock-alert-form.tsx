"use client";

import * as React from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * StockAlertForm — docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md PDP journey:
 * "Notify me when back in stock" on an out-of-stock product page. Shares
 * the submitted/thank-you visual pattern with `NewsletterForm` but is kept
 * as its own component per spec — the copy and context genuinely differ
 * (a restock alert for one product vs. a general marketing subscription)
 * and callers reason about them as distinct concepts, so merging them into
 * one generic "email capture" component would blur that.
 *
 * Accepts either an email or a Nepali phone number in a single field —
 * deliberately `type="text"` rather than `type="email"`/`type="tel"` so
 * either format is valid input; no client-side format validation is
 * attempted here since there's no backend yet to actually notify against.
 *
 * Same two-mode `onSubmit` contract as `NewsletterForm`: awaited in a
 * try/catch when provided (rollback to an inline error on rejection),
 * otherwise the thank-you state shows immediately so it's demoable
 * unwired.
 */
export interface StockAlertFormProps {
  productName?: string;
  onSubmit?: (contact: string) => void | Promise<void>;
  className?: string;
}

export function StockAlertForm({ productName, onSubmit, className }: StockAlertFormProps) {
  const [contact, setContact] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "pending" | "submitted" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!onSubmit) {
      setStatus("submitted");
      return;
    }

    setStatus("pending");
    try {
      await onSubmit(contact);
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  if (status === "submitted") {
    return (
      <div className={cn("flex items-center gap-2 text-body-sm text-on-surface", className)}>
        <Bell className="size-4 text-primary-container" aria-hidden="true" />
        <p>Thanks — we&apos;ll let you know.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-start gap-2">
        <Bell className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
        <div>
          <p className="text-body-md text-on-surface">Notify me when back in stock</p>
          <p className="text-body-sm text-on-surface-variant">
            {productName
              ? `We'll email you the moment ${productName} is available again.`
              : "We'll let you know the moment this item is available again."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          required
          placeholder="you@example.com or 98XXXXXXXX"
          aria-label="Email or phone number"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="primary" disabled={status === "pending"}>
          Notify me
        </Button>
      </form>

      {status === "error" && (
        <p role="alert" className="text-body-sm text-error">
          Something went wrong — please try again.
        </p>
      )}
    </div>
  );
}
