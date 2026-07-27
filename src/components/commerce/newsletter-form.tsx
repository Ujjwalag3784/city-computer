"use client";

import * as React from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * NewsletterForm — docs/05-DESIGN-SYSTEM.md §6 component inventory: a
 * standalone, reusable newsletter capture, distinct from the one already
 * inline inside `src/components/layout/site-footer.tsx` (that one stays
 * footer-only and untouched). This version is for other placements — blog
 * posts, a PDP sidebar, a promo module, etc. — anywhere the footer isn't
 * the container.
 *
 * No real newsletter API exists yet (same caveat as the footer's inline
 * copy). Two modes:
 *  - `onSubmit` given: awaited inside a try/catch. Only flips to the
 *    thank-you state on success; a rejection shows a brief inline error
 *    (docs/05 §5 A10-style `role="alert"`) and leaves the form usable so the
 *    visitor can retry, rather than blindly assuming success.
 *  - `onSubmit` omitted: flips to the thank-you state immediately, so the
 *    component is demoable with zero wiring.
 */
export interface NewsletterFormProps {
  onSubmit?: (email: string) => void | Promise<void>;
  className?: string;
}

export function NewsletterForm({ onSubmit, className }: NewsletterFormProps) {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "pending" | "submitted" | "error">("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!onSubmit) {
      setStatus("submitted");
      return;
    }

    setStatus("pending");
    try {
      await onSubmit(email);
      setStatus("submitted");
    } catch {
      setStatus("error");
    }
  }

  if (status === "submitted") {
    return (
      <div className={cn("flex items-center gap-2 text-body-sm text-on-surface", className)}>
        <Mail className="size-4 text-primary-container" aria-hidden="true" />
        <p>Thanks — you&apos;re on the list.</p>
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center gap-2">
        <Mail className="size-4 text-on-surface-variant" aria-hidden="true" />
        <p className="text-body-md text-on-surface">Get restock alerts and deals</p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="email"
          required
          placeholder="you@example.com"
          aria-label="Email address"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="flex-1"
        />
        <Button type="submit" variant="primary" disabled={status === "pending"}>
          Subscribe
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
