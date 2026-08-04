/**
 * The role-key catalogue and the two pure predicates over it, extracted
 * out of `server/auth/permissions.ts` so they can be shared with code that
 * cannot import anything under `server/**`.
 *
 * Why this file exists: `server/auth/permissions.ts` carries `import
 * "server-only"` (and imports `@/server/db`), which makes it unusable from
 * a plain `tsx`-run one-shot script — outside Next's bundler the
 * `server-only` package throws unconditionally (see `src/env-core.ts`'s
 * header for the full explanation). `prisma/seed/create-admin.ts` needs to
 * know which role keys grant admin access and which of them force TOTP
 * 2FA, so those two lists had to move somewhere importable from both
 * sides. `lib/**` is the correct home: they are plain data plus two
 * string-membership checks, with no database or request context involved.
 *
 * `server/auth/permissions.ts` re-exports everything here unchanged, so
 * every existing `import { isAdminRoleKey } from "@/server/auth/permissions"`
 * call site (middleware, guards, config, nav) is untouched and there is
 * still exactly one definition of each list.
 */

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
