/**
 * Higher-level guards built on top of `permissions.ts`'s `requirePermission`
 * — the checks that don't fit "does this session have permission X" but
 * are still needed at nearly every admin entry point: is there a session
 * at all, does it belong to an admin-ish role, and (for OWNER/MANAGER) has
 * it satisfied 2FA. `middleware.ts` uses these to gate `/admin/*` before
 * any route code runs (docs/13 §3: "gated in middleware.ts before any
 * route code runs"); service functions use `requirePermission` directly
 * for the finer-grained capability check.
 */
import "server-only";
import type { Session } from "next-auth";
import { ForbiddenError, UnauthenticatedError } from "@/lib/errors";
import { isAdminRoleKey, requiresTwoFactor } from "@/server/auth/permissions";
import { isAdminSessionWithinLimits } from "@/server/auth/session-state";

/** Throws `UnauthenticatedError` if there's no session. Returns the session, narrowed to non-null, otherwise. */
export function requireSession(session: Session | null): Session {
  if (!session) {
    throw new UnauthenticatedError();
  }
  return session;
}

/**
 * The full docs/13 §2/§3 admin-entry check: a valid session, holding at
 * least one non-`CUSTOMER` role, with 2FA satisfied if that role requires
 * it, and — the one check that can't be expressed from the session claims
 * alone — still within both the 8-hour absolute and 30-minute idle
 * windows tracked in `session-state.ts`. Any failure throws; callers don't
 * need to inspect a boolean and remember to act on it.
 */
export async function requireAdminSession(session: Session | null): Promise<Session> {
  const active = requireSession(session);

  const isAdmin = active.user.roleKeys.some(isAdminRoleKey);
  if (!isAdmin) {
    throw new ForbiddenError("This area is for staff accounts only.");
  }

  if (requiresTwoFactor(active.user.roleKeys) && !active.user.twoFactorVerified) {
    throw new ForbiddenError("Two-factor verification is required for this account.");
  }

  const withinLimits = await isAdminSessionWithinLimits(active.sessionToken);
  if (!withinLimits) {
    // Deliberately the same error a missing session gets — "your admin
    // session timed out" and "you were never signed in" both resolve to
    // "sign in again," and docs/13 §2's enumeration-resistance principle
    // (never leak more than necessary about *why*) applies here too.
    throw new UnauthenticatedError("Your session has expired. Please sign in again.");
  }

  return active;
}

/** True if `session` belongs to a `CUSTOMER`-only account (no admin-role membership) — the common case for every storefront/account page. */
export function isCustomerSession(session: Session | null): boolean {
  if (!session) return false;
  return !session.user.roleKeys.some(isAdminRoleKey);
}
