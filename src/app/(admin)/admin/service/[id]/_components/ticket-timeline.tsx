import { formatRelativeTime } from "@/lib/date";
import type { AdminTicketEvent } from "@/server/services/admin/service-tickets";

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
}

/** Plain-language history — docs/09 §7's "History panel. Every event with who did it and when," same shape as `admin/orders/[id]/_components/order-timeline.tsx` applied to `TicketEvent`. */
export function TicketTimeline({ events }: { events: AdminTicketEvent[] }) {
  if (events.length === 0) {
    return <p className="text-body-sm text-on-surface-variant">No history yet.</p>;
  }

  return (
    <ul className="flex flex-col gap-3">
      {events.map((event) => (
        <li key={event.id} className="flex flex-col gap-0.5 border-l-2 border-glass-stroke pl-3">
          <p className="text-body-sm text-on-surface">
            {event.actorName ?? "Someone"} moved this job to{" "}
            <span className="font-medium">{statusLabel(event.toStatus)}</span>
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
  );
}
