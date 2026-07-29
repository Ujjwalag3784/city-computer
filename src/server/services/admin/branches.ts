/**
 * `/admin/branches` ("Stores") — docs/09-ADMIN-DAD-MODE.md §3, OWNER
 * only. CRUD over `Branch` plus its 7-row `BranchHours` — every branch
 * always has exactly 7 `BranchHours` rows (one per `dayOfWeek`), same
 * invariant `prisma/seed/core.ts`'s own seed already establishes for the
 * one seeded branch.
 */
import "server-only";
import { db } from "@/server/db";
import { NotFoundError } from "@/lib/errors";
import { slugify } from "@/lib/slug";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import type { BranchFormInput } from "@/lib/validation/admin/branches";

export interface AdminBranchListItem {
  id: string;
  name: string;
  district: string;
  phone: string;
  isActive: boolean;
  isDefaultFulfilment: boolean;
}

export async function listBranchesForAdmin(): Promise<AdminBranchListItem[]> {
  const branches = await db.branch.findMany({ orderBy: { position: "asc" } });
  return branches.map((b) => ({
    id: b.id,
    name: b.name,
    district: b.district,
    phone: b.phone,
    isActive: b.isActive,
    isDefaultFulfilment: b.isDefaultFulfilment,
  }));
}

export interface AdminBranchHours {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export interface AdminBranchDetail {
  id: string;
  name: string;
  addressLine: string;
  district: string;
  province: string;
  phone: string;
  email: string | null;
  isPickupEnabled: boolean;
  isDefaultFulfilment: boolean;
  isActive: boolean;
  hours: AdminBranchHours[];
}

export async function getBranchForAdmin(branchId: string): Promise<AdminBranchDetail> {
  const branch = await db.branch.findUnique({
    where: { id: branchId },
    include: { hours: { orderBy: { dayOfWeek: "asc" } } },
  });
  if (!branch) throw new NotFoundError("Store");

  return {
    id: branch.id,
    name: branch.name,
    addressLine: branch.addressLine,
    district: branch.district,
    province: branch.province,
    phone: branch.phone,
    email: branch.email,
    isPickupEnabled: branch.isPickupEnabled,
    isDefaultFulfilment: branch.isDefaultFulfilment,
    isActive: branch.isActive,
    hours: branch.hours.map((h) => ({
      dayOfWeek: h.dayOfWeek,
      isClosed: h.isClosed,
      openTime: h.openTime,
      closeTime: h.closeTime,
    })),
  };
}

async function uniqueSlug(name: string, excludeId?: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  for (;;) {
    const existing = await db.branch.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

async function saveHours(branchId: string, hours: BranchFormInput["hours"]): Promise<void> {
  for (const day of hours) {
    await db.branchHours.upsert({
      where: { branchId_dayOfWeek: { branchId, dayOfWeek: day.dayOfWeek } },
      create: {
        branchId,
        dayOfWeek: day.dayOfWeek,
        isClosed: day.isClosed,
        openTime: day.isClosed ? null : (day.openTime ?? null),
        closeTime: day.isClosed ? null : (day.closeTime ?? null),
      },
      update: {
        isClosed: day.isClosed,
        openTime: day.isClosed ? null : (day.openTime ?? null),
        closeTime: day.isClosed ? null : (day.closeTime ?? null),
      },
    });
  }
}

export async function createBranch(
  input: BranchFormInput,
  actor: AuditActor,
): Promise<{ id: string }> {
  const slug = await uniqueSlug(input.name);
  const count = await db.branch.count();

  const branch = await db.branch.create({
    data: {
      slug,
      name: input.name.trim(),
      addressLine: input.addressLine.trim(),
      district: input.district.trim(),
      province: input.province,
      phone: input.phone.trim(),
      email: input.email || null,
      isPickupEnabled: input.isPickupEnabled,
      isDefaultFulfilment: input.isDefaultFulfilment,
      isActive: input.isActive,
      position: count,
    },
  });
  await saveHours(branch.id, input.hours);

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "branch.created",
    entityType: "Branch",
    entityId: branch.id,
    after: { name: branch.name },
  });

  return { id: branch.id };
}

export async function updateBranch(
  branchId: string,
  input: BranchFormInput,
  actor: AuditActor,
): Promise<void> {
  const before = await db.branch.findUnique({ where: { id: branchId } });
  if (!before) throw new NotFoundError("Store");

  await db.branch.update({
    where: { id: branchId },
    data: {
      name: input.name.trim(),
      addressLine: input.addressLine.trim(),
      district: input.district.trim(),
      province: input.province,
      phone: input.phone.trim(),
      email: input.email || null,
      isPickupEnabled: input.isPickupEnabled,
      isDefaultFulfilment: input.isDefaultFulfilment,
      isActive: input.isActive,
    },
  });
  await saveHours(branchId, input.hours);

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "branch.updated",
    entityType: "Branch",
    entityId: branchId,
    before: { name: before.name, isActive: before.isActive },
    after: { name: input.name, isActive: input.isActive },
  });
}
