/**
 * Per-session state that the `Session` Prisma model has no columns for —
 * tracked in Redis instead of via a schema migration.
 *
 * Why not just add columns: docs/13-SECURITY.md §2 needs (a) an admin
 * session's absolute lifetime capped at 8 hours regardless of activity,
 * (b) that same session killed after 30 minutes of *inactivity*, and (c) a
 * transient "has this session completed 2FA" flag. The `Session` model
 * (`prisma/schema/auth.prisma`) only has `expires` — one deadline, not two
 * independent clocks, and no 2FA flag at all. Adding fields would need
 * `prisma migrate` + `prisma generate`, and this sandbox's network policy
 * blocks Prisma's engine-binary CDN (see PROGRESS.md) — a schema edit here
 * would leave the generated client out of sync with no way to regenerate
 * it until someone runs that on a machine with real network access,
 * breaking typecheck in the meantime. Redis is already wired up
 * (`server/redis.ts`) and gives *correct* behaviour for all three needs
 * today, with zero schema risk: TTLs enforce the deadlines for free, and
 * nothing here is data that needs to survive a Redis restart (worst case,
 * a restart forces every admin to re-verify 2FA and resets idle timers —
 * safe-by-default, not a data-loss risk).
 *
 * Keyed by the database session's own `sessionToken` (already an opaque,
 * unguessable value per docs/13 §2's cookie spec), never by userId — a
 * user with two concurrent admin sessions (e.g. desktop + phone) gets
 * independent timers for each, which is the correct behaviour: revoking
 * or letting one idle out should not silently touch the other.
 */
import "server-only";
import { redis } from "@/server/redis";

/**
 * docs/13 §2: "Admin: 8-hour absolute". Exported so `config.ts`'s wrapped
 * adapter can set the *database row's* `expires` to the same deadline —
 * belt-and-braces: even if Redis were flushed, the Postgres-level session
 * still dies on schedule.
 */
export const ADMIN_SESSION_ABSOLUTE_TTL_SECONDS = 8 * 60 * 60;
/** docs/13 §2: "...30-minute idle." */
const ADMIN_SESSION_IDLE_TTL_SECONDS = 30 * 60;
/** A 2FA-verified claim shouldn't outlive the session it was verified for — capped at the same absolute window as a safe upper bound. */
const TWO_FACTOR_VERIFIED_TTL_SECONDS = ADMIN_SESSION_ABSOLUTE_TTL_SECONDS;

function issuedKey(sessionToken: string): string {
  return `session-state:${sessionToken}:issued`;
}

function activeKey(sessionToken: string): string {
  return `session-state:${sessionToken}:active`;
}

function twoFactorVerifiedKey(sessionToken: string): string {
  return `session-state:${sessionToken}:2fa-verified`;
}

/**
 * Starts the 8-hour absolute clock for an admin session. Called exactly
 * once, at session creation (the wrapped adapter in `config.ts`) — `NX`
 * (only-set-if-absent) means a later call for the same token is a no-op,
 * so nothing can accidentally push this deadline forward.
 */
export async function markAdminSessionIssued(sessionToken: string): Promise<void> {
  await redis.set(issuedKey(sessionToken), "1", "EX", ADMIN_SESSION_ABSOLUTE_TTL_SECONDS, "NX");
}

/**
 * Extends the 30-minute idle window. Called on every authenticated
 * `/admin/*` request (`middleware.ts`) — always overwrites, which is the
 * "rolling" half of the pair that `markAdminSessionIssued`'s `NX` is not.
 */
export async function touchAdminSessionActivity(sessionToken: string): Promise<void> {
  await redis.set(activeKey(sessionToken), "1", "EX", ADMIN_SESSION_IDLE_TTL_SECONDS);
}

/**
 * True only while the session is inside *both* windows. Either key
 * missing — whether because it never existed (not an admin session, or
 * never touched) or because its TTL elapsed — fails closed: this session
 * cannot be treated as a live admin session, full stop.
 */
export async function isAdminSessionWithinLimits(sessionToken: string): Promise<boolean> {
  const [issued, active] = await Promise.all([
    redis.exists(issuedKey(sessionToken)),
    redis.exists(activeKey(sessionToken)),
  ]);
  return issued === 1 && active === 1;
}

/** Records that this session has passed TOTP or recovery-code verification. Called once, right after a successful `verifyTotpToken`/`matchRecoveryCode`. */
export async function markTwoFactorVerified(sessionToken: string): Promise<void> {
  await redis.set(twoFactorVerifiedKey(sessionToken), "1", "EX", TWO_FACTOR_VERIFIED_TTL_SECONDS);
}

/** Read by `callbacks.ts`'s `session` callback to populate `session.user.twoFactorVerified`. */
export async function isTwoFactorVerified(sessionToken: string): Promise<boolean> {
  const verified = await redis.exists(twoFactorVerifiedKey(sessionToken));
  return verified === 1;
}

/**
 * Deletes every Redis-tracked flag for a session — call this alongside
 * `adapter.deleteSession` (sign-out, or docs/13 §2's "password change...
 * kills every session for that user") so a revoked session token can never
 * pass `isAdminSessionWithinLimits`/`isTwoFactorVerified` again even
 * during the window before its own TTLs would have expired naturally.
 */
export async function clearSessionState(sessionToken: string): Promise<void> {
  await redis.del(
    issuedKey(sessionToken),
    activeKey(sessionToken),
    twoFactorVerifiedKey(sessionToken),
  );
}
