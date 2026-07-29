/**
 * `/admin/coupons` ("Discount codes") — admin CRUD over the `Coupon`
 * model docs/17 Phase 6 already built shopper-facing validation for
 * (`commerce/coupon.ts`'s `previewCoupon`). That file's own doc comment
 * notes coupons are validated/previewed but never created anywhere in the
 * admin — this is that missing write surface. Every mutation goes through
 * `recordAuditLog`, same as every other admin CRUD screen in this
 * codebase.
 *
 * `value` is stored in the same unit `Coupon.value` itself uses
 * (percentage points OR paisa, per that field's own schema comment) —
 * the admin form collects whole rupees for FIXED_AMOUNT and converts with
 * `rupeesToPaisa` here, never in the client.
 */
import "server-only";
import { db } from "@/server/db";
import type { Prisma } from "@/generated/prisma/client";
import { CouponType } from "@/generated/prisma/client";
import { NotFoundError, AppError } from "@/lib/errors";
import { rupeesToPaisa } from "@/lib/money";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import type { AdminCouponListQuery, CouponFormInput } from "@/lib/validation/admin/coupons";

export interface AdminCouponListItem {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  usedCount: number;
  usageLimit: number | null;
  isActive: boolean;
  startsAt: Date | null;
  endsAt: Date | null;
}

const COUPON_LIST_PAGE_SIZE = 20;

function buildListWhere(query: AdminCouponListQuery, now: Date): Prisma.CouponWhereInput {
  const clauses: Prisma.CouponWhereInput[] = [];
  if (query.q) {
    clauses.push({
      OR: [
        { code: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
      ],
    });
  }
  if (query.filter === "active") {
    clauses.push({ isActive: true, OR: [{ endsAt: null }, { endsAt: { gte: now } }] });
  } else if (query.filter === "inactive") {
    clauses.push({ isActive: false });
  } else if (query.filter === "expired") {
    clauses.push({ endsAt: { lt: now } });
  }
  return clauses.length > 0 ? { AND: clauses } : {};
}

export async function listCouponsForAdmin(
  query: AdminCouponListQuery,
  now: Date = new Date(),
): Promise<{ items: AdminCouponListItem[]; total: number; hasNext: boolean }> {
  const where = buildListWhere(query, now);
  const [rows, total] = await Promise.all([
    db.coupon.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * COUPON_LIST_PAGE_SIZE,
      take: COUPON_LIST_PAGE_SIZE + 1,
    }),
    db.coupon.count({ where }),
  ]);
  const hasNext = rows.length > COUPON_LIST_PAGE_SIZE;
  return {
    items: rows.slice(0, COUPON_LIST_PAGE_SIZE).map((c) => ({
      id: c.id,
      code: c.code,
      description: c.description,
      type: c.type,
      value: c.value,
      usedCount: c.usedCount,
      usageLimit: c.usageLimit,
      isActive: c.isActive,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
    })),
    total,
    hasNext,
  };
}

export async function getCouponForAdmin(couponId: string) {
  const coupon = await db.coupon.findUnique({ where: { id: couponId } });
  if (!coupon) throw new NotFoundError("Coupon");
  return coupon;
}

function toCouponData(input: CouponFormInput) {
  const valuePaisa =
    input.type === CouponType.FIXED_AMOUNT ? rupeesToPaisa(input.value) : input.value;
  return {
    code: input.code.trim().toUpperCase(),
    description: input.description?.trim() || null,
    type: input.type,
    value: input.type === CouponType.FREE_SHIPPING ? 0 : valuePaisa,
    minOrderPaisa: input.minOrderRupees !== undefined ? rupeesToPaisa(input.minOrderRupees) : null,
    maxDiscountPaisa:
      input.maxDiscountRupees !== undefined ? rupeesToPaisa(input.maxDiscountRupees) : null,
    usageLimit: input.usageLimit ?? null,
    usageLimitPerCustomer: input.usageLimitPerCustomer ?? null,
    startsAt: input.startsAt ? new Date(input.startsAt) : null,
    endsAt: input.endsAt ? new Date(input.endsAt) : null,
    appliesTo: input.appliesTo,
    targetIds: input.targetIds,
    excludeDiscounted: input.excludeDiscounted,
    firstOrderOnly: input.firstOrderOnly,
    isActive: input.isActive,
  } satisfies Prisma.CouponUncheckedCreateInput;
}

export async function createCoupon(
  input: CouponFormInput,
  actor: AuditActor,
): Promise<{ id: string }> {
  const data = toCouponData(input);
  const existing = await db.coupon.findUnique({ where: { code: data.code } });
  if (existing) {
    throw new AppError("COUPON_INVALID", `A discount code called "${data.code}" already exists.`);
  }

  const coupon = await db.coupon.create({ data });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "coupon.created",
    entityType: "Coupon",
    entityId: coupon.id,
    after: { code: coupon.code, type: coupon.type, value: coupon.value },
  });
  return { id: coupon.id };
}

export async function updateCoupon(
  couponId: string,
  input: CouponFormInput,
  actor: AuditActor,
): Promise<void> {
  const before = await db.coupon.findUnique({ where: { id: couponId } });
  if (!before) throw new NotFoundError("Coupon");

  const data = toCouponData(input);
  if (data.code !== before.code) {
    const clash = await db.coupon.findUnique({ where: { code: data.code } });
    if (clash) {
      throw new AppError("COUPON_INVALID", `A discount code called "${data.code}" already exists.`);
    }
  }

  await db.coupon.update({ where: { id: couponId }, data });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "coupon.updated",
    entityType: "Coupon",
    entityId: couponId,
    before: { code: before.code, value: before.value, isActive: before.isActive },
    after: { code: data.code, value: data.value, isActive: data.isActive },
  });
}

export async function setCouponActive(
  couponId: string,
  isActive: boolean,
  actor: AuditActor,
): Promise<void> {
  const before = await db.coupon.findUnique({
    where: { id: couponId },
    select: { isActive: true },
  });
  if (!before) throw new NotFoundError("Coupon");

  await db.coupon.update({ where: { id: couponId }, data: { isActive } });
  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: isActive ? "coupon.activated" : "coupon.deactivated",
    entityType: "Coupon",
    entityId: couponId,
    before: { isActive: before.isActive },
    after: { isActive },
  });
}
