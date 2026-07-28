/**
 * The Auth.js `session` callback — the one place every session-check
 * request (`auth()`, `middleware.ts`) passes through. Computes the RBAC
 * claims (`types/next-auth.d.ts`'s module augmentation) fresh from the
 * database and from `session-state.ts`'s Redis flags every time, rather
 * than trusting anything cached client-side.
 */
import "server-only";
import type { Session } from "next-auth";
import type { AdapterSession, AdapterUser } from "next-auth/adapters";
import { loadUserRoleAndPermissionKeys, requiresTwoFactor } from "@/server/auth/permissions";
import { isTwoFactorVerified } from "@/server/auth/session-state";

export interface SessionCallbackParams {
  session: AdapterSession & { user: AdapterUser };
  user: AdapterUser;
}

/**
 * Only meaningful for the database session strategy this app uses
 * (docs/13 §2: "Session storage: Database-backed (not JWT)") — the `user`
 * argument is only populated by Auth.js in that mode.
 */
export async function sessionCallback({ session, user }: SessionCallbackParams): Promise<Session> {
  const { roleKeys, permissionKeys } = await loadUserRoleAndPermissionKeys(user.id);
  const twoFactorEnabled = Boolean(user.twoFactorSecret);
  const needsTwoFactor = requiresTwoFactor(roleKeys);
  // Accounts that don't need 2FA (or haven't enrolled) are trivially
  // "verified" for gating purposes — the requirement middleware.ts checks
  // is "2FA satisfied *if it's required*", not "2FA exists".
  const twoFactorVerified = needsTwoFactor ? await isTwoFactorVerified(session.sessionToken) : true;

  return {
    user: {
      ...session.user,
      id: user.id,
      roleKeys,
      permissionKeys,
      twoFactorEnabled,
      twoFactorVerified,
    },
    // `DefaultSession.expires` is an ISO date *string* (it's sent to the
    // browser as JSON) — the adapter's `AdapterSession.expires` we
    // destructured out of is a `Date`, so it has to be converted rather
    // than spread through as-is.
    expires: session.expires.toISOString(),
    sessionToken: session.sessionToken,
  };
}
