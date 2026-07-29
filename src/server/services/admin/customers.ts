/**
 * `/admin/customers` — docs/09-ADMIN-DAD-MODE.md §3 ("Customers" — OWNER,
 * MANAGER, SUPPORT) and §12 ("Customer support... can view orders and
 * customers and reply to messages"). docs/10-PAYMENTS-NEPAL.md §7's COD
 * fraud table and docs/13-SECURITY.md §5's threat table both point at
 * `Customer.codBlocked` as the repeat-refusal blocklist this screen has to
 * expose a real toggle for — `commerce/payments/cod.ts` already enforces
 * it at checkout (Phase 7); this file is the admin surface that actually
 * sets it.
 *
 * List + detail reads plus the two narrow mutations this screen owns
 * (`setCustomerCodBlocked`, `updateCustomerNotes`) — same "list/detail
 * service, mutations recorded via `recordAuditLog`" shape as
 * `admin/orders.ts` + its route's own `_actions.ts`, just co-located here
 * since these two mutations are small enough not to need a state-machine
 * file of their own.
 *
 * `Customer.notes` (docs/06 §4: "Text — internal, admin-only") is a single
 * free-text field, not a `CustomerNote[]` table — there is no dedicated
 * notes-history model in the schema. Every overwrite is still recoverable
 * via Activity History (`recordAuditLog` stores the full before/after
 * text), so nothing is silently lost, but there's no per-note timestamp/
 * author list the way `PriceHistory` gives products — a real, flagged
 * simplification matching the schema as it exists today rather than a
 * schema change invented for this pass.
 */
import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { NotFoundError } from "@/lib/errors";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import type { AdminCustomerFilter, AdminCustomerListQuery } from "@/lib/validation/admin/customers";

export interface AdminCustomerListItem {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  codBlocked: boolean;
  totalOrders: number;
  totalSpentPaisa: number;
  lastOrderAt: Date | null;
  createdAt: Date;
}

export interface AdminCustomerListResult {
  items: AdminCustomerListItem[];
  total: number;
  hasNext: boolean;
}

const CUSTOMER_LIST_PAGE_SIZE = 20;
const NEW_THIS_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function buildListWhere(query: AdminCustomerListQuery, now: Date): Prisma.CustomerWhereInput {
  const clauses: Prisma.CustomerWhereInput[] = [];

  if (query.q) {
    clauses.push({
      OR: [
        { name: { contains: query.q, mode: "insensitive" } },
        { phone: { contains: query.q } },
        { email: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }

  const filter: AdminCustomerFilter = query.filter;
  if (filter === "cod-blocked") {
    clauses.push({ codBlocked: true });
  } else if (filter === "new-this-week") {
    clauses.push({ createdAt: { gte: new Date(now.getTime() - NEW_THIS_WEEK_MS) } });
  }

  return clauses.length > 0 ? { AND: clauses } : {};
}

export async function listCustomersForAdmin(
  query: AdminCustomerListQuery,
  now: Date = new Date(),
): Promise<AdminCustomerListResult> {
  const where = buildListWhere(query, now);

  const [rows, total] = await Promise.all([
    db.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * CUSTOMER_LIST_PAGE_SIZE,
      take: CUSTOMER_LIST_PAGE_SIZE + 1,
    }),
    db.customer.count({ where }),
  ]);

  const hasNext = rows.length > CUSTOMER_LIST_PAGE_SIZE;
  const items = rows.slice(0, CUSTOMER_LIST_PAGE_SIZE).map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    tags: customer.tags,
    codBlocked: customer.codBlocked,
    totalOrders: customer.totalOrders,
    totalSpentPaisa: customer.totalSpentPaisa,
    lastOrderAt: customer.lastOrderAt,
    createdAt: customer.createdAt,
  }));

  return { items, total, hasNext };
}

export interface AdminCustomerAddress {
  id: string;
  label: string;
  fullName: string;
  phone: string;
  province: string;
  district: string;
  municipality: string;
  ward: number | null;
  streetAddress: string;
  landmark: string | null;
  latitude: number | null;
  longitude: number | null;
  isDefault: boolean;
}

export interface AdminCustomerRecentOrder {
  id: string;
  orderNumber: string;
  status: string;
  totalPaisa: number;
  placedAt: Date;
}

export interface AdminCustomerDetail {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  tags: string[];
  codBlocked: boolean;
  notes: string | null;
  totalOrders: number;
  totalSpentPaisa: number;
  lastOrderAt: Date | null;
  createdAt: Date;
  addresses: AdminCustomerAddress[];
  recentOrders: AdminCustomerRecentOrder[];
}

export async function getCustomerForAdmin(customerId: string): Promise<AdminCustomerDetail> {
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: {
      addresses: { orderBy: { createdAt: "desc" } },
      orders: {
        orderBy: { placedAt: "desc" },
        take: 10,
        select: { id: true, orderNumber: true, status: true, totalPaisa: true, placedAt: true },
      },
    },
  });
  if (!customer) throw new NotFoundError("Customer");

  return {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    email: customer.email,
    tags: customer.tags,
    codBlocked: customer.codBlocked,
    notes: customer.notes,
    totalOrders: customer.totalOrders,
    totalSpentPaisa: customer.totalSpentPaisa,
    lastOrderAt: customer.lastOrderAt,
    createdAt: customer.createdAt,
    addresses: customer.addresses.map((address) => ({
      id: address.id,
      label: address.label,
      fullName: address.fullName,
      phone: address.phone,
      province: address.province,
      district: address.district,
      municipality: address.municipality,
      ward: address.ward,
      streetAddress: address.streetAddress,
      landmark: address.landmark,
      latitude: address.latitude,
      longitude: address.longitude,
      isDefault: address.isDefault,
    })),
    recentOrders: customer.orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalPaisa: order.totalPaisa,
      placedAt: order.placedAt,
    })),
  };
}

/**
 * Flips `Customer.codBlocked` and records why on both directions (see
 * this file's own top-of-file note on why "unblocking" needs a reason
 * too). Throws `NotFoundError` rather than silently no-op-ing on a bad id
 * — same "fail loud on a bad reference" stance as every other admin
 * mutation in this codebase.
 */
export async function setCustomerCodBlocked(
  customerId: string,
  blocked: boolean,
  reason: string,
  actor: AuditActor,
): Promise<void> {
  const before = await db.customer.findUnique({
    where: { id: customerId },
    select: { codBlocked: true },
  });
  if (!before) throw new NotFoundError("Customer");

  await db.customer.update({ where: { id: customerId }, data: { codBlocked: blocked } });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: blocked ? "customer.cod_blocked" : "customer.cod_unblocked",
    entityType: "Customer",
    entityId: customerId,
    before: { codBlocked: before.codBlocked },
    after: { codBlocked: blocked, reason },
  });
}

export async function updateCustomerNotes(
  customerId: string,
  notes: string,
  actor: AuditActor,
): Promise<void> {
  const before = await db.customer.findUnique({
    where: { id: customerId },
    select: { notes: true },
  });
  if (!before) throw new NotFoundError("Customer");

  const trimmed = notes.trim();
  await db.customer.update({ where: { id: customerId }, data: { notes: trimmed || null } });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "customer.notes_updated",
    entityType: "Customer",
    entityId: customerId,
    before: { notes: before.notes },
    after: { notes: trimmed || null },
  });
}
