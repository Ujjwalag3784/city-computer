/**
 * Per-session state that the `Session` Prisma model has no columns for:
 * docs/13-SECURITY.md §2's (a) 8-hour absolute admin session lifetime,
 * (b) 30-minute idle timeout, (c) "has this session completed 2FA" flag,
 * and (d) the candidate secret of an in-progress 2FA enrollment.
 *
 * Stored in the expiring key/value table in Postgres (`server/kv-store.ts`).
 * It used to live in Redis, which was unreachable from the live site, so no
 * admin could ever sign in. Losing this state is safe by default: a missing
 * key means "not verified" / "outside the limits", which sends the admin
 * back through sign-in.
 *
 * Keyed by the database session's own `sessionToken` (already an opaque,
 * unguessable value per docs/13 §2's cookie spec), never by userId — a
 * user with two concurrent admin sessions (e.g. desktop + phone) gets
 * independent timers for each, which is the correct behaviour: revoking
 * or letting one idle out should not silently touch the other.
 */
import "server-only";
import { kvCountLive, kvDelete, kvGet, kvSet, kvSetIfAbsent } from "@/server/kv-store";
import { logger } from "@/lib/logger";

/**
 * docs/13 §2: "Admin: 8-hour absolute". Exported so `config.ts`'s wrapped
 * adapter can set the *database row's* `expires` to the same deadline —
 * belt-and-braces: even if these keys were lost, the session row itself
 * still dies on schedule.
 */
export const ADMIN_SESSION_ABSOLUTE_TTL_SECONDS = 8 * 60 * 60;
/** docs/13 §2: "...30-minute idle." */
const ADMIN_SESSION_IDLE_TTL_SECONDS = 30 * 60;
/** A 2FA-verified claim shouldn't outlive the session it was verified for — capped at the same absolute window as a safe upper bound. */
const TWO_FACTOR_VERIFIED_TTL_SECONDS = ADMIN_SESSION_ABSOLUTE_TTL_SECONDS;
/** How long an in-progress TOTP enrollment's candidate secret stays valid. Long enough to install an authenticator app mid-flow, short enough that an abandoned attempt doesn't linger. */
const PENDING_TWO_FACTOR_SECRET_TTL_SECONDS = 15 * 60;

function issuedKey(sessionToken: string): string {
  return `session-state:${sessionToken}:issued`;
}

function activeKey(sessionToken: string): string {
  return `session-state:${sessionToken}:active`;
}

function twoFactorVerifiedKey(sessionToken: string): string {
  return `session-state:${sessionToken}:2fa-verified`;
}

function pendingTwoFactorSecretKey(sessionToken: string): string {
  return `session-state:${sessionToken}:2fa-pending-secret`;
}

/**
 * Starts the 8-hour absolute clock for an admin session. Called exactly
 * once, at session creation (the wrapped adapter in `config.ts`) — `NX`
 * (only-set-if-absent) means a later call for the same token is a no-op,
 * so nothing can accidentally push this deadline forward.
 */
export async function markAdminSessionIssued(sessionToken: string): Promise<void> {
  await kvSetIfAbsent(issuedKey(sessionToken), "1", ADMIN_SESSION_ABSOLUTE_TTL_SECONDS);
}

/**
 * Extends the 30-minute idle window. Called on every authenticated
 * `/admin/*` request (`middleware.ts`) — always overwrites, which is the
 * "rolling" half of the pair that `markAdminSessionIssued`'s `NX` is not.
 */
export async function touchAdminSessionActivity(sessionToken: string): Promise<void> {
  await kvSet(activeKey(sessionToken), "1", ADMIN_SESSION_IDLE_TTL_SECONDS);
}

/**
 * True only while the session is inside *both* windows. Either key
 * missing — whether because it never existed (not an admin session, or
 * never touched) or because its TTL elapsed — fails closed: this session
 * cannot be treated as a live admin session, full stop.
 *
 * An unreachable store fails closed too, but deliberately as a `false`
 * rather than a throw. `middleware.ts` awaits this on every authenticated
 * `/admin/*` request, so before this `catch` existed an ETIMEDOUT against
 * Upstash propagated straight out of the middleware and returned HTTP 500
 * for the entire admin console — a crash that, in Vercel's logs, was
 * indistinguishable from the render bugs fixed alongside it. Returning
 * `false` denies the session exactly as firmly (the caller redirects to
 * sign-in) while keeping the cause legible in one log line. Note this only
 * softens the *read* on the hot path: the writes below still reject, because
 * they sit on explicit actions where a silent no-op would be the dangerous
 * outcome — a `markAdminSessionIssued` that quietly did nothing would mint a
 * session with no clocks on it at all.
 */
export async function isAdminSessionWithinLimits(sessionToken: string): Promise<boolean> {
  try {
    const live = await kvCountLive([issuedKey(sessionToken), activeKey(sessionToken)]);
    return live === 2;
  } catch (error) {
    logger.error(
      { error },
      "Session store unreachable checking admin session limits - denying access",
    );
    return false;
  }
}

/** Records that this session has passed TOTP or recovery-code verification. Called once, right after a successful `verifyTotpToken`/`matchRecoveryCode`. */
export async function markTwoFactorVerified(sessionToken: string): Promise<void> {
  await kvSet(twoFactorVerifiedKey(sessionToken), "1", TWO_FACTOR_VERIFIED_TTL_SECONDS);
}

/** Read by `callbacks.ts`'s `session` callback to populate `session.user.twoFactorVerified`. */
export async function isTwoFactorVerified(sessionToken: string): Promise<boolean> {
  return (await kvCountLive([twoFactorVerifiedKey(sessionToken)])) === 1;
}

/**
 * Deletes every tracked flag for a session — call this alongside
 * `adapter.deleteSession` (sign-out, or docs/13 §2's "password change...
 * kills every session for that user") so a revoked session token can never
 * pass `isAdminSessionWithinLimits`/`isTwoFactorVerified` again even
 * during the window before its own TTLs would have expired naturally.
 */
export async function clearSessionState(sessionToken: string): Promise<void> {
  await kvDelete(
    issuedKey(sessionToken),
    activeKey(sessionToken),
    twoFactorVerifiedKey(sessionToken),
    pendingTwoFactorSecretKey(sessionToken),
  );
}

/**
 * Remembers the candidate TOTP secret an OWNER/MANAGER is part-way through
 * enrolling, and returns whichever secret is now authoritative for this
 * session.
 *
 * `SET ... NX` then `GET`, deliberately, rather than a plain `SET`: the
 * enrollment page generates a fresh candidate on every render, and a plain
 * overwrite would mean a page refresh (or React rendering twice) silently
 * invalidating the QR code the operator has already scanned into their
 * phone. `NX` makes the *first* candidate stick for the whole TTL, so the
 * QR shown and the secret stored can never disagree, and refreshing shows
 * the same code instead of restarting the process.
 *
 * Server-side state rather than a hidden form field (which `two-factor.ts`'s own
 * comment suggests) for two reasons: a hidden field would have to be signed
 * to stop an injected value being enrolled on the victim's behalf, and this
 * app already keeps every other piece of per-session 2FA state right here,
 * keyed the same way, expiring the same way.
 *
 * Nothing is written to `User.twoFactorSecret` until
 * `confirmTwoFactorEnrollment` verifies a live code against this candidate,
 * so an abandoned enrollment never leaves an account set-but-unverified.
 */
export async function rememberPendingTwoFactorSecret(
  sessionToken: string,
  candidateSecret: string,
): Promise<string> {
  const key = pendingTwoFactorSecretKey(sessionToken);
  await kvSetIfAbsent(key, candidateSecret, PENDING_TWO_FACTOR_SECRET_TTL_SECONDS);
  const stored = await kvGet(key);
  // A null read here means the key expired between the two commands — an
  // exceedingly narrow window, but returning the candidate keeps the QR the
  // caller is about to render consistent with what it will verify against.
  return stored ?? candidateSecret;
}

/** Reads back the candidate secret for a session's in-progress enrollment. Null if it expired or was never started, which the caller must treat as "start again", never as "skip verification". */
export async function readPendingTwoFactorSecret(sessionToken: string): Promise<string | null> {
  return kvGet(pendingTwoFactorSecretKey(sessionToken));
}

/** Drops the candidate secret once enrollment has been committed to `User.twoFactorSecret`. */
export async function forgetPendingTwoFactorSecret(sessionToken: string): Promise<void> {
  await kvDelete(pendingTwoFactorSecretKey(sessionToken));
}
