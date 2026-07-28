/**
 * Activity History — docs/06-DATA-MODEL.md §10's append-only `AuditLog`
 * model, docs/09-ADMIN-DAD-MODE.md §13 ("`/admin/activity`, Owner only.
 * Plain-language, filterable, searchable, exportable... Every admin
 * mutation writes an entry with before/after values.") and §8's error-
 * prevention table ("Every change writes a `StockMovement`" / every
 * mutation appears in Activity History is one of Phase 5's acceptance
 * criteria in docs/17).
 *
 * This is the one write path every other admin service in this phase
 * (category/brand CRUD, the product wizard, stock adjustments, order
 * status changes) calls after a successful mutation — deliberately a
 * single, tiny, dependency-free function rather than baked into each
 * service's own `db.<model>.update(...)` call, so nothing has to
 * remember the exact `AuditLog` shape independently and drift is
 * impossible.
 *
 * `recordAuditLog` never throws on the caller's behalf for a failed
 * write — see the comment on its `Promise<void>` return: callers should
 * treat this the same way `catalog/search.ts` treats `logSearchQuery`,
 * fire-and-forget with its own `.catch`, so a logging outage can never
 * turn into a broken product save. (Unlike `StockMovement`, which is the
 * system of record for `StockLevel.quantity` and therefore MUST be
 * written in the same transaction as the level change — `AuditLog` is
 * observability, not a ledger.)
 */
import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";

/**
 * The `{ id, email }` shape every admin mutation service needs to stamp
 * an `AuditLog` row with who did it — deliberately just the two fields
 * `recordAuditLog` actually stores (`actorId`/`actorEmail`), not a full
 * `Session["user"]`, so a service function's signature doesn't imply it
 * can read roles/permissions off this parameter (it can't — that check
 * already happened before the actor got this far; see
 * `server/auth/require-admin-permission.ts`).
 */
export interface AuditActor {
  id: string;
  email: string | null;
}

export interface RecordAuditLogInput {
  /** Null for system-initiated changes (jobs, webhooks) with no human actor. */
  actorId: string | null;
  /**
   * Denormalised at write time per the schema comment on `AuditLog.actorEmail`
   * — "reads correctly even if the actor is later deleted or their email
   * changes." Callers pass the acting session's email, not a fresh lookup.
   */
  actorEmail: string | null;
  /**
   * A short, present-tense verb phrase describing what happened — e.g.
   * `"product.price_changed"`, `"stock.adjusted"`, `"category.created"`.
   * Dotted `resource.event` form (distinct from `permissions.ts`'s
   * colon-separated `resource:action` capability keys) so the two
   * vocabularies are never visually confusable in a log line or a filter
   * dropdown.
   */
  action: string;
  /** e.g. `"Product"`, `"Category"`, `"StockLevel"` — matches the Prisma model name. */
  entityType: string;
  entityId: string;
  /** The changed fields' prior values only, not the whole row — keeps log rows small and diffs legible. */
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Fire this after a mutation has already committed. Deliberately does not
 * wrap the caller's own write in a transaction with this insert — the
 * append-only log lagging behind by one write on a rare failure is an
 * acceptable trade against every product/category/stock mutation needing
 * to widen its own transaction just to include an unrelated table.
 */
export async function recordAuditLog(input: RecordAuditLogInput): Promise<void> {
  await db.auditLog.create({
    data: {
      actorId: input.actorId,
      actorEmail: input.actorEmail,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      before: input.before ?? undefined,
      after: input.after ?? undefined,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

export interface AuditLogEntry {
  id: string;
  actorId: string | null;
  actorEmail: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before: Prisma.JsonValue | null;
  after: Prisma.JsonValue | null;
  createdAt: Date;
}

export interface ListAuditLogInput {
  /** Filters to one record's own history tab (e.g. a product's "Stock history" — docs/09 §6). */
  entityType?: string;
  entityId?: string;
  actorId?: string;
  page?: number;
  perPage?: number;
}

export interface ListAuditLogResult {
  items: AuditLogEntry[];
  total: number;
  page: number;
  perPage: number;
  hasNext: boolean;
}

const DEFAULT_PER_PAGE = 50;

/**
 * Backs both `/admin/activity` (docs/09 §13, no filters applied) and any
 * per-record "history" panel (docs/09 §7's order detail "History panel",
 * §6's per-product "Stock history" timeline) by passing `entityType` +
 * `entityId`. Plain-language sentence rendering ("Sita changed the price
 * of...") is a presentation concern for the `/admin/activity` page itself
 * (Phase 5g) — this service only returns the structured rows.
 */
export async function listAuditLog(input: ListAuditLogInput = {}): Promise<ListAuditLogResult> {
  const page = input.page && input.page > 0 ? Math.floor(input.page) : 1;
  const perPage = input.perPage && input.perPage > 0 ? Math.floor(input.perPage) : DEFAULT_PER_PAGE;

  const where = {
    ...(input.entityType ? { entityType: input.entityType } : {}),
    ...(input.entityId ? { entityId: input.entityId } : {}),
    ...(input.actorId ? { actorId: input.actorId } : {}),
  };

  const [rows, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.auditLog.count({ where }),
  ]);

  return {
    items: rows,
    total,
    page,
    perPage,
    hasNext: page * perPage < total,
  };
}
