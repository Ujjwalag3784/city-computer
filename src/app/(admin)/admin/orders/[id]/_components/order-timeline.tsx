import { ActivityFeedItem } from "@/components/admin/activity-feed-item";
import type { AdminOrderStatusEvent } from "@/server/services/admin/orders";

function statusLabel(status: string): string {
  return status
    .toLowerCase()
    .split("_")
    .map((word) => word[0]?.toUpperCase() + word.slice(1))
    .join(" ");
}

function actorLabel(event: AdminOrderStatusEvent): string {
  if (event.actorType === "CUSTOMER") return "The customer";
  if (event.actorType === "SYSTEM") return "The system";
  if (event.actorType === "GATEWAY") return "A payment gateway";
  return event.actorName ?? "An admin";
}

/** `OrderStatusEvent[]` (append-only, docs/06 §6) rendered as a stack of `ActivityFeedItem`s — reused as-is from `components/admin/`, no dedicated timeline container exists yet (confirmed during this pass's own research), so this file is just the mapping. */
export function OrderTimeline({ events }: { events: AdminOrderStatusEvent[] }) {
  if (events.length === 0) {
    return <p className="text-body-sm text-on-surface-variant">No status history yet.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-glass-stroke">
      {events.map((event) => (
        <li key={event.id}>
          <ActivityFeedItem
            actorName={actorLabel(event)}
            action={`moved this order to ${statusLabel(event.toStatus)}`}
            targetLabel={event.note ?? undefined}
            timestamp={event.createdAt.toISOString()}
          />
        </li>
      ))}
    </ul>
  );
}
