import type { ComponentType } from "react";
import Link from "next/link";
import { formatRelativeTime } from "@/lib/date";
import { cn } from "@/lib/utils";

/**
 * ActivityFeedItem — a single row for the `/admin/activity` "Activity
 * History" route (docs/02-PRODUCT-SCOPE-AND-JOURNEYS.md route map),
 * backed by the append-only `AuditLog` model (docs/06-DATA-MODEL.md).
 * Also reusable for the dashboard's Row 4 "Recent orders" / "Recent
 * customers" lists (docs/09-ADMIN-DAD-MODE.md §4), which are the same
 * shape: someone did something to something, at some time.
 *
 * Renders as "{actorName} {action}" with an optional `targetLabel` set in
 * `font-medium` immediately after (e.g. "Sita marked order as packed —
 * CC-2607-0042"), so the record ID/name that matters most for a quick scan
 * stands out from the surrounding sentence without needing colour.
 *
 * `timestamp` (an ISO string, matching the `createdAt` convention already
 * used by `ReviewData` in `src/components/commerce/review-list.tsx`) is
 * formatted with the existing `formatRelativeTime` helper from
 * `src/lib/date.ts` ("2 minutes ago") rather than a hand-rolled
 * `Intl.DateTimeFormat` call — an activity feed is exactly the "how long
 * ago did this happen" use case that helper exists for, unlike the
 * absolute-date `formatKathmanduDate` used for review dates.
 *
 * No `"use client"`: plain presentational composition, optionally wrapped
 * in a `next/link` when `href` is given (a shop owner tapping "Sita marked
 * order as packed" should land on that order) — same rationale as
 * `ProductCard` for not needing a client boundary just to render a link.
 */
export interface ActivityFeedItemProps {
  actorName: string;
  action: string;
  targetLabel?: string;
  /** ISO date string. */
  timestamp: string;
  icon?: ComponentType<{ className?: string }>;
  href?: string;
  className?: string;
}

export function ActivityFeedItem({
  actorName,
  action,
  targetLabel,
  timestamp,
  icon: Icon,
  href,
  className,
}: ActivityFeedItemProps) {
  const body = (
    <>
      {Icon && (
        <Icon className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden="true" />
      )}
      <span className="flex-1 text-body-sm text-on-surface">
        {actorName} {action}
        {targetLabel && <span className="font-medium text-on-surface"> — {targetLabel}</span>}
      </span>
      <time dateTime={timestamp} className="shrink-0 text-label-mono-xs text-on-surface-variant">
        {formatRelativeTime(new Date(timestamp))}
      </time>
    </>
  );

  const rowClassName = cn("flex items-start gap-2 py-2", className);

  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          rowClassName,
          "rounded transition-colors hover:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-container focus-visible:ring-offset-2 focus-visible:ring-offset-surface-container",
        )}
      >
        {body}
      </Link>
    );
  }

  return <div className={rowClassName}>{body}</div>;
}
