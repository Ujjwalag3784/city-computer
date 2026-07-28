/**
 * docs/13-SECURITY.md §2: "Password change, email change, role change, or
 * explicit revocation kills every session for that user." One shared
 * implementation so every caller (password-reset.ts, change-password,
 * a future admin "revoke this user's sessions" action, role-change
 * handling) invalidates sessions the same way — deleting the database
 * rows AND clearing their Redis-tracked state (`session-state.ts`), so a
 * session that was mid-way through its 8h admin window can't keep working
 * off stale Redis flags after its database row is gone.
 */
import "server-only";
import { db } from "@/server/db";
import { clearSessionState } from "@/server/auth/session-state";

export async function revokeAllSessionsForUser(userId: string): Promise<void> {
  const sessions = await db.session.findMany({
    where: { userId },
    select: { sessionToken: true },
  });

  await Promise.all(sessions.map((session) => clearSessionState(session.sessionToken)));
  await db.session.deleteMany({ where: { userId } });
}
