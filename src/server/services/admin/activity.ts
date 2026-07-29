/**
 * `/admin/activity` ("Activity History") — docs/09-ADMIN-DAD-MODE.md §13:
 * "Plain-language, filterable, searchable, exportable... Every admin
 * mutation writes an entry with before/after values." The append-only
 * `AuditLog` table and its `listAuditLog` reader already exist
 * (`admin/audit-log.ts`, Phase 5g) — this file is only the presentation
 * layer §13 was still missing: turning one `AuditLogEntry` into the
 * plain-English sentence the page renders.
 *
 * **Scope note:** docs §13's own examples ("Sita Karki changed the price
 * of HP Victus 15 from रु 129,900 to रु 124,900") are bespoke, per-action
 * sentences. Hand-writing one templated sentence for every action string
 * this codebase's ~30 `recordAuditLog` call sites use (and every future
 * one) doesn't scale and silently goes stale the next time a module adds
 * a new action. Instead: a small curated map covers the handful of
 * highest-traffic actions with a natural sentence, and everything else
 * falls back to a humanised "{actor} {did something} to {a Product/
 * Order/...}" phrase plus a compact "field: before -> after" line built
 * straight from the entry's own JSON — genuinely plain language, just not
 * hand-tuned prose for every action. Exporting (the CSV download docs §13
 * also lists) is NOT built this pass — flagged, not silently dropped.
 */
import "server-only";
import { formatRelativeTime } from "@/lib/date";
import type { AuditLogEntry } from "@/server/services/admin/audit-log";

const ENTITY_LABEL: Record<string, string> = {
  Product: "a product",
  Category: "a category",
  Brand: "a brand",
  Variant: "a product",
  Order: "an order",
  Payment: "a payment",
  Customer: "a customer",
  Coupon: "a discount code",
  Promotion: "a campaign",
  Review: "a review",
  Enquiry: "a message",
  ServiceTicket: "a repair job",
  Media: "a photo",
};

/** A handful of hand-tuned, natural-reading sentences for the most common actions — everything else falls back to `humanizeAction`. */
const ACTION_SENTENCE: Record<string, (entry: AuditLogEntry) => string> = {
  "product.priceChanged": () => "changed the price of a product",
  "product.published": () => "published a product",
  "product.unpublished": () => "unpublished a product",
  "stock.adjusted": () => "adjusted stock for a product",
  "order.statusChanged": () => "updated an order's status",
  "payment.approved": () => "approved a payment",
  "payment.rejected": () => "rejected a payment",
  "customer.cod_blocked": () => "blocked a customer from Cash on Delivery",
  "customer.cod_unblocked": () => "allowed a customer to use Cash on Delivery again",
  "review.approved": () => "approved a review",
  "review.rejected": () => "rejected a review",
  "coupon.activated": () => "turned on a discount code",
  "coupon.deactivated": () => "turned off a discount code",
  "campaign.activated": () => "turned on a campaign",
  "campaign.deactivated": () => "turned off a campaign",
};

function humanizeAction(action: string, entityType: string): string {
  const [, ...verbParts] = action.split(".");
  const verbRaw = verbParts.join(" ") || action;
  const verb = verbRaw
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .toLowerCase();
  // eslint-disable-next-line security/detect-object-injection -- `entityType` is one of this codebase's own fixed Prisma model names, never arbitrary user input.
  const noun = ENTITY_LABEL[entityType] ?? "a record";
  return `${verb || "changed"} ${noun}`;
}

function diffLine(entry: AuditLogEntry): string | null {
  if (
    !entry.before ||
    !entry.after ||
    typeof entry.before !== "object" ||
    typeof entry.after !== "object"
  ) {
    return null;
  }
  const before = entry.before as Record<string, unknown>;
  const after = entry.after as Record<string, unknown>;
  const keys = Object.keys(after).filter((key) => {
    // eslint-disable-next-line security/detect-object-injection -- `key` is drawn from `Object.keys(after)` itself, never arbitrary input.
    return key in before && before[key] !== after[key];
  });
  if (keys.length === 0) return null;
  return (
    keys
      .slice(0, 3)
      // eslint-disable-next-line security/detect-object-injection -- `key` is drawn from `Object.keys(after)` itself, never arbitrary input.
      .map((key) => `${key}: ${String(before[key])} → ${String(after[key])}`)
      .join(" · ")
  );
}

export interface ActivityHistoryRow {
  id: string;
  actorName: string;
  sentence: string;
  diff: string | null;
  when: string;
  createdAt: Date;
}

export function toActivityHistoryRow(
  entry: AuditLogEntry,
  now: Date = new Date(),
): ActivityHistoryRow {
  const actorName = entry.actorEmail ?? "Someone";
  const sentenceBuilder = ACTION_SENTENCE[entry.action];
  const sentence = sentenceBuilder
    ? sentenceBuilder(entry)
    : humanizeAction(entry.action, entry.entityType);

  return {
    id: entry.id,
    actorName,
    sentence,
    diff: diffLine(entry),
    when: formatRelativeTime(entry.createdAt, now),
    createdAt: entry.createdAt,
  };
}
