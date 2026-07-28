/**
 * The docs/13-SECURITY.md §3 authorisation model: "Permission-based
 * (resource:action), never role-string comparison" and "Enforcement point:
 * the service layer. A Route Handler and a Server Action calling the same
 * service cannot diverge."
 *
 * Split into a DB-hitting loader (`loadUserRoleAndPermissionKeys`, called
 * exactly once per session check, from `callbacks.ts`'s `session`
 * callback) and a pure checker (`requirePermission`, called from every
 * service function, many times per request, against the already-loaded
 * claims already sitting on `session.user`) — the same "DB write vs. pure
 * read" split `lib/rate-limit.ts` uses for the same reason: the thing
 * worth unit-testing extensively (permission logic) shouldn't need a
 * database to test.
 */
import "server-only";
import { db } from "@/server/db";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";

/**
 * Every role key that is NOT `CUSTOMER` — i.e. "has some admin surface
 * access," per prisma/seed/core.ts's `ROLES`. `CUSTOMER` is the only role
 * seeded onto ordinary storefront accounts.
 */
export const ADMIN_ROLE_KEYS = [
  "OWNER",
  "MANAGER",
  "STAFF",
  "CONTENT_EDITOR",
  "SUPPORT",
  "TECHNICIAN",
] as const;

export type AdminRoleKey = (typeof ADMIN_ROLE_KEYS)[number];

/** docs/13 §2: "TOTP mandatory for OWNER and MANAGER." Every other admin role may enroll but isn't forced to. */
export const TWO_FACTOR_MANDATORY_ROLE_KEYS = ["OWNER", "MANAGER"] as const;

export interface UserRoleAndPermissionKeys {
  roleKeys: string[];
  permissionKeys: string[];
}

/**
 * The one DB query behind every session's `roleKeys`/`permissionKeys`
 * claims. Deliberately not memoised/cached here — it runs once per session
 * check (via the `session` callback), and docs/13 §2's "role change...
 * kills every session for that user" is exactly what keeps a cached claim
 * from ever going stale for the lifetime of a session that's still valid.
 */
export async function loadUserRoleAndPermissionKeys(
  userId: string,
): Promise<UserRoleAndPermissionKeys> {
  const userRoles = await db.userRole.findMany({
    where: { userId },
    include: {
      role: {
        include: { rolePermissions: { include: { permission: true } } },
      },
    },
  });

  const roleKeys = new Set<string>();
  const permissionKeys = new Set<string>();
  for (const userRole of userRoles) {
    roleKeys.add(userRole.role.key);
    for (const rolePermission of userRole.role.rolePermissions) {
      permissionKeys.add(rolePermission.permission.key);
    }
  }

  return { roleKeys: [...roleKeys], permissionKeys: [...permissionKeys] };
}

/** True if `roleKey` is one of the seeded non-`CUSTOMER` roles — i.e. this role grants *some* admin-surface access. Doesn't check permissions; a role having admin access at all is a coarser question than what it can do. */
export function isAdminRoleKey(roleKey: string): roleKey is AdminRoleKey {
  return (ADMIN_ROLE_KEYS as readonly string[]).includes(roleKey);
}

/** True if any of `roleKeys` requires TOTP 2FA (docs/13 §2: OWNER, MANAGER). */
export function requiresTwoFactor(roleKeys: readonly string[]): boolean {
  return roleKeys.some((key) =>
    (TWO_FACTOR_MANDATORY_ROLE_KEYS as readonly string[]).includes(key),
  );
}

/** Pure membership check — no DB, no session lookup. Exists mainly so `requirePermission` and tests share one definition of "has". */
export function permissionSetHas(permissionKeys: readonly string[], required: string): boolean {
  return permissionKeys.includes(required);
}

/**
 * The docs/13 §3 enforcement primitive every service function calls:
 * `requirePermission(session?.user ?? null, "order:refund")`. Throws
 * `UnauthenticatedError` when there's no session at all, `ForbiddenError`
 * when there is a session but it lacks the permission — a caller never
 * has to branch on which happened, matching docs/13 §2's enumeration-
 * resistance principle (never leak *why*, only *that*, access was denied).
 *
 * Returns the claims unchanged on success so a call can double as a
 * narrowing guard: `const { id } = requirePermission(session?.user, ...)`.
 */
export function requirePermission<T extends { permissionKeys: string[] }>(
  claims: T | null | undefined,
  permissionKey: string,
): T {
  if (!claims) {
    throw new UnauthenticatedError();
  }
  if (!permissionSetHas(claims.permissionKeys, permissionKey)) {
    throw new ForbiddenError();
  }
  return claims;
}
