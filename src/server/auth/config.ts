/**
 * The Auth.js v5 configuration object — providers, adapter, session
 * strategy. `server/auth/index.ts` is what actually calls `NextAuth()`
 * with this; kept separate so the config itself (what docs/04's tree
 * calls out as `auth/config.ts`) stays readable without the `NextAuth()`
 * plumbing around it.
 */
import "server-only";
import type { Adapter, AdapterSession } from "next-auth/adapters";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { db } from "@/server/db";
import { env } from "@/env";
import { logger } from "@/lib/logger";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/password";
import { normalizeNepalPhone } from "@/lib/nepal";
import { rateLimit } from "@/server/rate-limit-store";
import { getRequestIp } from "@/lib/request-ip";
import { isAdminRoleKey, loadUserRoleAndPermissionKeys } from "@/server/auth/permissions";
import {
  ADMIN_SESSION_ABSOLUTE_TTL_SECONDS,
  clearSessionState,
  markAdminSessionIssued,
  touchAdminSessionActivity,
} from "@/server/auth/session-state";
import { sessionCallback } from "@/server/auth/callbacks";

// docs/13 §2: "Customers: 30-day rolling." This app-wide default only
// governs *customer* sessions in practice — the wrapped adapter below
// overrides it for admin-role users at the database row level.
const CUSTOMER_SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const CUSTOMER_SESSION_UPDATE_AGE_SECONDS = 24 * 60 * 60;

/**
 * `@auth/prisma-adapter`'s published types import `PrismaClient` from the
 * bare `@prisma/client` package. This project's Prisma 7 generator has a
 * custom `output` (`prisma/schema/schema.prisma`'s `generator client`
 * block generates into `src/generated/prisma`, not `node_modules/
 * @prisma/client`) — so the two `PrismaClient` types are structurally
 * different declarations of "a Prisma client," and `db` (this app's real,
 * extended client) doesn't satisfy the adapter's parameter type by name.
 * It satisfies it by *shape* (every model delegate the adapter actually
 * calls — `user`, `account`, `session`, `verificationToken` — exists with
 * a compatible signature), which is exactly what this cast asserts. A
 * real type mismatch here (e.g. a renamed model) would still be caught:
 * `PrismaAdapter`'s own internals would fail at the first mismatched
 * method call, not silently succeed.
 */
function wrapPrismaAdapter(): Adapter {
  const base = PrismaAdapter(db as unknown as Parameters<typeof PrismaAdapter>[0]);
  return withAdminSessionPolicy(base);
}

/**
 * Overrides three Adapter methods to implement docs/13 §2's admin-vs-
 * customer session policy split, and to keep `session-state.ts`'s Redis
 * flags in sync with the database session's real lifecycle:
 *
 * - `createSession`: admin-role users get `expires` set to `now + 8h`
 *   (the absolute cap) instead of whatever the global `maxAge` computed,
 *   and their Redis "issued"/"active" timers start here.
 * - `updateSession`: Auth.js calls this to roll a session's `expires`
 *   forward once it's within `updateAge` of expiring. For admin sessions
 *   this is a deliberate no-op — the 8h absolute cap must never be
 *   extended by activity; the *idle* half of the policy is enforced
 *   separately, per-request, by `touchAdminSessionActivity` in
 *   `middleware.ts`, not by moving this row's `expires`.
 * - `deleteSession`: clears the Redis flags alongside the database row so
 *   a revoked token can't satisfy `isAdminSessionWithinLimits` during the
 *   gap before its own TTLs would've expired naturally.
 */
function withAdminSessionPolicy(adapter: Adapter): Adapter {
  return {
    ...adapter,

    async createSession(session: Parameters<NonNullable<Adapter["createSession"]>>[0]) {
      if (!adapter.createSession) {
        throw new Error("withAdminSessionPolicy: base adapter has no createSession");
      }

      const { roleKeys } = await loadUserRoleAndPermissionKeys(session.userId);
      const isAdmin = roleKeys.some(isAdminRoleKey);

      if (!isAdmin) {
        return adapter.createSession(session);
      }

      const adminExpires = new Date(Date.now() + ADMIN_SESSION_ABSOLUTE_TTL_SECONDS * 1000);
      const created = await adapter.createSession({ ...session, expires: adminExpires });
      await markAdminSessionIssued(created.sessionToken);
      await touchAdminSessionActivity(created.sessionToken);
      return created;
    },

    async updateSession(
      session: Parameters<NonNullable<Adapter["updateSession"]>>[0],
    ): Promise<AdapterSession | null | undefined> {
      if (!adapter.updateSession || !adapter.getSessionAndUser) {
        throw new Error(
          "withAdminSessionPolicy: base adapter is missing updateSession/getSessionAndUser",
        );
      }

      const existing = await adapter.getSessionAndUser(session.sessionToken);
      if (!existing) {
        return adapter.updateSession(session);
      }

      const { roleKeys } = await loadUserRoleAndPermissionKeys(existing.session.userId);
      if (roleKeys.some(isAdminRoleKey)) {
        // No-op: never extend an admin session's absolute deadline just
        // because it was accessed. Returning the untouched row (rather
        // than `undefined`) tells Auth.js the update "succeeded" without
        // it needing special-case handling for a no-op.
        return existing.session;
      }

      return adapter.updateSession(session);
    },

    async deleteSession(sessionToken: string): Promise<AdapterSession | null | undefined> {
      await clearSessionState(sessionToken);
      if (!adapter.deleteSession) return undefined;
      // The base adapter's declared return type is a `Promise<void> |
      // Awaitable<AdapterSession | null | undefined>` union — at runtime
      // `void` and `undefined` are the same value, so this narrows safely.
      const result = await adapter.deleteSession(sessionToken);
      return result as AdapterSession | null | undefined;
    },
  };
}

/**
 * Enumeration-resistant Credentials lookup: accepts an email OR a Nepali
 * phone number as `identifier` (docs/07 §4.1), returns `null` — never a
 * distinguishable error — for "no such account," "wrong password," and
 * "account locked," so a failed login never reveals which of those was
 * true. docs/13 §2's "Registration, login and reset return identical
 * messages and are timing-normalised" is the caller-facing half of this;
 * the timing-normalisation itself lives in `hashPassword`/`verifyPassword`
 * always doing the same Argon2id work regardless of outcome, since this
 * function still calls `verifyPassword` even against a dummy hash when no
 * user is found (see `DUMMY_HASH_FOR_TIMING` below).
 */
const DUMMY_HASH_FOR_TIMING =
  "$argon2id$v=19$m=19456,t=2,p=1$MDAwMDAwMDAwMDAwMDAwMA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

/**
 * One instance, referenced twice: as `authConfig.adapter`, and directly by
 * `authConfig.jwt.encode` below — which has to mint its session through the
 * *same* wrapped adapter, or an admin session would be created without the
 * 8-hour cap and the Redis clocks `withAdminSessionPolicy` attaches.
 */
const sessionAdapter = wrapPrismaAdapter();

export const authConfig: NextAuthConfig = {
  adapter: sessionAdapter,
  session: {
    strategy: "database",
    maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
    updateAge: CUSTOMER_SESSION_UPDATE_AGE_SECONDS,
  },
  // docs/13 §6: `__Secure-` prefix, HttpOnly, Secure, SameSite=Lax — Auth.js's
  // defaults already match this for the session-token cookie; listed
  // explicitly so a future change to Auth.js's defaults doesn't silently
  // drift away from the documented policy.
  cookies: {
    sessionToken: {
      name: "__Secure-authjs.session-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: true,
      },
    },
  },
  providers: [
    Credentials({
      id: "credentials",
      name: "Credentials",
      credentials: {
        identifier: { label: "Email or phone" },
        password: { label: "Password", type: "password" },
      },
      async authorize(rawCredentials, request) {
        const parsed = loginSchema.safeParse(rawCredentials);
        if (!parsed.success) return null;
        const { identifier, password } = parsed.data;

        const ip = getRequestIp(request);
        // docs/13 §2: "5 attempts / 15 min per IP and per identifier."
        await rateLimit("auth", `ip:${ip}`);
        await rateLimit("auth", `identifier:${identifier.toLowerCase()}`);

        const normalizedPhone = normalizeNepalPhone(identifier);
        const user = await db.user.findFirst({
          where: normalizedPhone
            ? { OR: [{ email: identifier.toLowerCase() }, { phone: normalizedPhone }] }
            : { email: identifier.toLowerCase() },
        });

        if (!user?.passwordHash) {
          // No such user, or an OAuth-only account with no password set —
          // still pay the Argon2id cost against a dummy hash so this
          // branch takes the same time as a real mismatch below.
          await verifyPassword(DUMMY_HASH_FOR_TIMING, password);
          return null;
        }

        if (user.status !== "ACTIVE") {
          logger.warn(
            { userId: user.id, status: user.status },
            "authorize: login attempt on non-active account",
          );
          return null;
        }

        if (user.lockedUntil && user.lockedUntil > new Date()) {
          logger.warn({ userId: user.id }, "authorize: login attempt on locked account");
          return null;
        }

        const passwordValid = await verifyPassword(user.passwordHash, password);
        if (!passwordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // docs/13 §2: "Provider-verified email required."
      allowDangerousEmailAccountLinking: false,
    }),
  ],
  pages: {
    signIn: "/auth/login",
    error: "/auth/login",
  },
  /**
   * THE FIX FOR "SIGNING IN DID NOTHING". Read this before touching it.
   *
   * Auth.js's Credentials provider is a JWT-strategy feature. Its branch of
   * `@auth/core`'s callback route is hard-coded to the JWT path regardless
   * of `session.strategy`:
   *
   *     const token = await callbacks.jwt({ token: defaultToken, user, … })
   *     const newToken = await jwt.encode({ ...jwt, token, salt })
   *     cookies.push(...sessionStore.chunk(newToken, { expires }))
   *
   * — it never calls `adapter.createSession`. `assertConfig` is *supposed*
   * to reject that combination, but its guard is
   * `dbStrategy && onlyCredentials`, and `onlyCredentials` is false here
   * because the Google provider exists. So the mismatch passed silently:
   * a successful password sign-in set `__Secure-authjs.session-token` to an
   * encrypted JWT, wrote no `Session` row, and started none of
   * `session-state.ts`'s Redis clocks. Every subsequent request read that
   * cookie under `strategy: "database"`, handed the JWT string to
   * `adapter.getSessionAndUser` as if it were a session token, found
   * nothing, and treated the caller as signed out — so `adminMiddleware`
   * bounced them straight back to `/auth/login`. From the operator's chair
   * that is a form that does nothing at all. Sign-*out* was broken by the
   * same mismatch, `deleteSession` being handed a JWT that matches no row.
   *
   * Overriding `encode` is the documented way to close the gap while
   * keeping database sessions: mint the row ourselves and return its opaque
   * `sessionToken` as the cookie value, which is exactly what the OAuth
   * branch does one `if` above. Going the other way — flipping the app to
   * `strategy: "jwt"` — was rejected: `revoke-sessions.ts`, the 8-hour
   * absolute / 30-minute idle windows, and every per-session Redis key
   * (including the 2FA flag) are all keyed on a real `Session` row, and a
   * self-contained JWT cannot be revoked server-side at all. docs/13 §2
   * says "Session storage: Database-backed (not JWT)" for those reasons.
   *
   * Under `strategy: "database"` this override is only ever reached from
   * that one credentials branch — `session()` decodes JWTs only on the JWT
   * path, and the OAuth branch skips `jwt.encode` entirely — so there is no
   * fallback path to preserve, and a token with no subject is a bug worth
   * failing loudly on rather than papering over with another
   * silently-unusable cookie. If `session.strategy` above is ever changed
   * to "jwt", delete this whole block: it would then be minting orphan
   * database rows on every sign-in.
   */
  jwt: {
    async encode({ token }) {
      const userId = token?.sub;
      if (!userId) {
        throw new Error(
          "authConfig.jwt.encode: credentials sign-in produced a token with no subject; refusing to issue a session cookie that cannot resolve to a session.",
        );
      }
      if (!sessionAdapter.createSession) {
        throw new Error("authConfig.jwt.encode: adapter has no createSession");
      }

      // Customer default; `withAdminSessionPolicy.createSession` overrides
      // this to the 8-hour absolute cap for admin-role users and starts
      // their Redis clocks, exactly as it does for an OAuth sign-in.
      const created = await sessionAdapter.createSession({
        sessionToken: crypto.randomUUID(),
        userId,
        expires: new Date(Date.now() + CUSTOMER_SESSION_MAX_AGE_SECONDS * 1000),
      });
      return created.sessionToken;
    },
  },
  callbacks: {
    session: sessionCallback,
  },
  secret: env.AUTH_SECRET,
};
