"use client";

import { Lightbulb, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * ExpertTipCard — a short educational aside surfaced during the build
 * process (e.g. explaining why RAM speed matters before the Memory step),
 * same spirit as docs/09-ADMIN-DAD-MODE.md §10's "In-product help" applied
 * here to the builder's less-technical moments, per docs/08-PC-BUILDER-
 * ENGINE.md §1 principle 8's plain-language ethos ("'This graphics card is
 * 358mm long...' Not 'GPU_LENGTH_CONSTRAINT_VIOLATION'").
 *
 * Deliberately calm/low-key, not a warning: `bg-surface-container-high`
 * (never amber/red/`text-warning`/`text-error` tones) because this is
 * friendly context offered proactively, not an issue the shopper needs to
 * resolve — that register is reserved for `issue-row.tsx`/`compatibility-
 * panel.tsx`'s validation output elsewhere in this directory.
 *
 * `"use client"`: `onDismiss` is wired directly to a `Button`'s `onClick` in
 * this file's own render tree whenever it's rendered — the same "handler
 * owned by this file" reasoning already established by `compare-table.tsx`/
 * `cart-line-item.tsx`/`step-rail.tsx` in this codebase.
 */
export interface ExpertTipCardProps {
  title: string;
  body: string;
  onDismiss?: () => void;
  className?: string;
}

export function ExpertTipCard({ title, body, onDismiss, className }: ExpertTipCardProps) {
  return (
    <Card
      variant="surface"
      borderTone="none"
      className={cn("relative flex gap-3 bg-surface-container-high p-4", className)}
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Lightbulb className="size-4" aria-hidden="true" />
      </span>
      <div className={cn("flex flex-col gap-1", onDismiss && "pr-8")}>
        <p className="text-body-md font-medium text-on-surface">{title}</p>
        <p className="text-body-sm text-on-surface-variant">{body}</p>
      </div>

      {onDismiss && (
        <Button
          type="button"
          variant="ghost"
          size="md"
          iconOnly
          aria-label="Dismiss tip"
          onClick={onDismiss}
          className="absolute right-1 top-1 text-on-surface-variant hover:text-on-surface"
        >
          <X aria-hidden="true" />
        </Button>
      )}
    </Card>
  );
}
