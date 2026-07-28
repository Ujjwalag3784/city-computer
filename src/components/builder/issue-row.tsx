"use client";

import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * IssueRow — docs/08-PC-BUILDER-ENGINE.md §9 "Issue presentation", surface 3:
 * "Issue list — grouped by severity, each row expandable into a Fix
 * drawer." Per §9's copy rule ("Copy is plain language. Never a rule code,
 * never a spec key, never 'constraint violation'"), `message` is always
 * assumed to already be plain-language text produced upstream — this
 * component never formats or translates a rule code itself.
 *
 * This row doesn't render or import the Fix drawer itself; it only exposes
 * an `onFix` callback so the page that *does* own the drawer (built
 * separately) can open it, keeping the two decoupled.
 *
 * `"use client"` — `onFix` is wired directly to a native `<button>`'s
 * `onClick` in this file's own render tree, the same convention already
 * established by `step-rail.tsx`/`compare-table.tsx`/`cart-line-item.tsx`:
 * a function prop attached to a host element can't cross the Server ->
 * Client boundary, so the owning component must itself be a Client
 * Component regardless of whether a given render actually receives `onFix`.
 *
 * Icon + tone mapping (docs/05-DESIGN-SYSTEM.md §5 A6 "never colour
 * alone" — every tone below pairs its colour with a distinct icon):
 *   error   -> AlertCircle   + danger tone
 *   warning -> AlertTriangle + warning tone
 *   info    -> Info          + a neutral/primary ("info") tone
 */
export type IssueSeverity = "error" | "warning" | "info";

export interface IssueRowProps {
  severity: IssueSeverity;
  /** Plain-language issue text — never a rule code or spec key (§9). */
  message: string;
  /** Opens the Fix drawer for this issue, owned by the parent page. */
  onFix?: () => void;
  className?: string;
}

const SEVERITY_ICON: Record<IssueSeverity, typeof AlertCircle> = {
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_TEXT_CLASS: Record<IssueSeverity, string> = {
  error: "text-danger",
  warning: "text-warning",
  info: "text-info",
};

export function IssueRow({ severity, message, onFix, className }: IssueRowProps) {
  // `severity` is the closed `IssueSeverity` union, not arbitrary input.
  // eslint-disable-next-line security/detect-object-injection
  const Icon = SEVERITY_ICON[severity];

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-glass-stroke bg-surface-container p-3",
        className,
      )}
    >
      <Icon
        className={cn(
          "mt-0.5 size-4 shrink-0",
          // eslint-disable-next-line security/detect-object-injection
          SEVERITY_TEXT_CLASS[severity],
        )}
        aria-hidden="true"
      />
      <p className="flex-1 text-body-sm text-on-surface">{message}</p>
      {onFix && (
        <Button variant="outline" size="sm" onClick={onFix}>
          Fix this
        </Button>
      )}
    </div>
  );
}
