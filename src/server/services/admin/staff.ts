/**
 * `/admin/users` ("Staff accounts") — docs/09-ADMIN-DAD-MODE.md §12,
 * OWNER only: "Adding a staff member asks for a name, a phone or email,
 * and a role — with each role's description visible while choosing."
 *
 * SCOPE, flagged rather than faked:
 * - **One role per staff member.** `UserRole` is schema-modelled
 *   many-to-many (a user could hold several roles), but docs §12's own
 *   UI description ("a role", singular) and the plain-language role
 *   table only ever describe someone picking one. `updateStaffRole`
 *   therefore replaces every existing `UserRole` row for a user rather
 *   than adding to them — simpler to reason about for a shop owner, and
 *   matches what the doc actually shows.
 * - **No invite email.** This codebase has no outbound mailer anywhere
 *   yet (see `admin/enquiries.ts`'s own note on the same gap). Instead,
 *   `createStaffMember` generates a random temporary password, returned
 *   once in the Server Action's response for the Owner to hand to the
 *   new hire directly — a real, working credential, just delivered
 *   out-of-band rather than by email.
 * - **2FA enrollment** (docs §12: mandatory for Owner/Manager) already
 *   has real enforcement machinery from Phase 3
 *   (`permissions.ts`'s `requiresTwoFactor`) — this file doesn't
 *   duplicate that, it only creates the account and role.
 */
import "server-only";
import { db } from "@/server/db";
import { UserStatus } from "@/generated/prisma/client";
import { NotFoundError, AppError } from "@/lib/errors";
import { hashPassword } from "@/lib/password";
import { recordAuditLog, type AuditActor } from "@/server/services/admin/audit-log";
import { STAFF_ROLE_DESCRIPTIONS } from "@/lib/validation/admin/staff";
import type { CreateStaffInput } from "@/lib/validation/admin/staff";

/**
 * Re-exported unchanged from `@/lib/validation/admin/staff`, which is where
 * the role label/description table actually lives — it has to be importable
 * from `staff-role-select.tsx`, a Client Component, and this module is
 * `server-only`. Kept exported here so the `/admin/users` server pages that
 * already read it from this module are untouched, and so there is still
 * exactly one definition. Same pattern as `server/auth/permissions.ts`
 * re-exporting `@/lib/admin-roles`.
 */
export { STAFF_ROLE_DESCRIPTIONS };

export interface AdminStaffListItem {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  roleKeys: string[];
  lastLoginAt: Date | null;
}

export async function listStaffForAdmin(): Promise<AdminStaffListItem[]> {
  const users = await db.user.findMany({
    where: { userRoles: { some: { role: { key: { not: "CUSTOMER" } } } } },
    orderBy: { createdAt: "asc" },
    include: { userRoles: { include: { role: true } } },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    status: user.status,
    roleKeys: user.userRoles.map((ur) => ur.role.key),
    lastLoginAt: user.lastLoginAt,
  }));
}

function generateTemporaryPassword(): string {
  const alphabet = "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  let result = "";
  for (const byte of bytes) {
    result += alphabet[byte % alphabet.length];
  }
  return result;
}

async function getRoleIdByKey(roleKey: string): Promise<string> {
  const role = await db.role.findUnique({ where: { key: roleKey } });
  if (!role) throw new AppError("INTERNAL_ERROR", `Role "${roleKey}" isn't seeded.`);
  return role.id;
}

export async function createStaffMember(
  input: CreateStaffInput,
  actor: AuditActor,
): Promise<{ id: string; temporaryPassword: string }> {
  if (input.email) {
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing)
      throw new AppError("VALIDATION_FAILED", "Someone already has an account with that email.");
  }
  if (input.phone) {
    const existing = await db.user.findUnique({ where: { phone: input.phone } });
    if (existing)
      throw new AppError(
        "VALIDATION_FAILED",
        "Someone already has an account with that phone number.",
      );
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);
  const roleId = await getRoleIdByKey(input.roleKey);

  const user = await db.user.create({
    data: {
      name: input.name.trim(),
      email: input.email || null,
      phone: input.phone || null,
      passwordHash,
      status: UserStatus.ACTIVE,
      userRoles: { create: { roleId } },
    },
  });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "staff.created",
    entityType: "User",
    entityId: user.id,
    after: { name: user.name, roleKey: input.roleKey },
  });

  return { id: user.id, temporaryPassword };
}

export async function updateStaffRole(
  userId: string,
  roleKey: string,
  actor: AuditActor,
): Promise<void> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: { userRoles: { include: { role: true } } },
  });
  if (!user) throw new NotFoundError("Staff member");

  const roleId = await getRoleIdByKey(roleKey);
  const beforeRoleKeys = user.userRoles.map((ur) => ur.role.key);

  await db.$transaction([
    db.userRole.deleteMany({ where: { userId } }),
    db.userRole.create({ data: { userId, roleId } }),
  ]);

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: "staff.role_changed",
    entityType: "User",
    entityId: userId,
    before: { roleKeys: beforeRoleKeys },
    after: { roleKeys: [roleKey] },
  });
}

export async function setStaffStatus(
  userId: string,
  isActive: boolean,
  actor: AuditActor,
): Promise<void> {
  if (!isActive && userId === actor.id) {
    throw new AppError("VALIDATION_FAILED", "You can't turn off your own account.");
  }

  const before = await db.user.findUnique({ where: { id: userId }, select: { status: true } });
  if (!before) throw new NotFoundError("Staff member");

  const status = isActive ? UserStatus.ACTIVE : UserStatus.SUSPENDED;
  await db.user.update({ where: { id: userId }, data: { status } });

  await recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    action: isActive ? "staff.reactivated" : "staff.suspended",
    entityType: "User",
    entityId: userId,
    before: { status: before.status },
    after: { status },
  });
}
