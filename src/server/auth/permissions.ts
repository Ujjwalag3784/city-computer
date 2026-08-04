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
 * The role-key catalogue and the two pure predicates over it now live in
 * `@/lib/admin-roles` and are re-exported here unchanged.
 *
 * Why: `prisma/seed/create-admin.ts` (`pnpm db:create-admin`) needs to know
 * which roles grant admin access and which force TOTP 2FA, and it runs
 * under plain `tsx`, where this file's own `import "server-only"` throws
 * unconditionally (see `src/env-core.ts`'s header). Moving the plain data
 * and the two string checks down into `lib/` — which has no server
 * dependencies — lets both sides share one definition instead of the seed
 * script keeping a second copy that could silently drift out of step with
 * the middleware's actual gate.
 *
 * Every existing `from "@/server/auth/permissions"` import keeps working:
 * this is a re-export, not a move-and-update-call-sites.
 */
export {
  ADMIN_ROLE_KEYS,
  TWO_FACTOR_MANDATORY_ROLE_KEYS,
  isAdminRoleKey,
  requiresTwoFactor,
  type AdminRoleKey,
} from "@/lib/admin-roles";

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
