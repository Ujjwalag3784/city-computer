/**
 * Turns whatever `signIn("credentials", …)` rejects with into the one
 * sentence `/auth/login` is allowed to show, and nothing else.
 *
 * Kept here — pure, dependency-free, no `next-auth` import — rather than
 * inline in the Server Action so it can be unit-tested. The action itself
 * cannot be: it calls `signIn`, which reads request headers and talks to
 * Postgres and Redis.
 *
 * ── Why the shape of the incoming error is so awkward ──
 *
 * `@auth/core`'s credentials callback wraps anything `authorize()` throws:
 *
 *     catch (e) {
 *       if (e instanceof AuthError) throw e
 *       throw new CallbackRouteError(e, { provider: provider.id })
 *     }
 *
 * and `AuthError`'s constructor stores the original at `cause.err`, not at
 * `cause`. So a rate-limit `AppError` raised inside `authorize()` arrives as
 * `CallbackRouteError { cause: { err: AppError } }`. `authorize()` returning
 * `null` (the enumeration-resistant path for every credential failure)
 * arrives instead as a bare `CredentialsSignin`. Both are `AuthError`s, and
 * telling them apart is the whole job of this module.
 *
 * ── What may and may not be distinguished ──
 *
 * docs/13 §2: "Registration, login and reset return identical messages and
 * are timing-normalised." `config.ts`'s `authorize()` already collapses
 * "no such account", "wrong password", "suspended" and "locked" into a
 * single `null`, and this module must not undo that — all four produce
 * {@link SIGN_IN_FAILED_MESSAGE}, verbatim, and there is deliberately no
 * branch here that could ever separate them. In particular there is no
 * "your account is locked" message: that would confirm the account exists.
 *
 * A rate limit *is* surfaced separately, and that is not a weakening.
 * `authorize()` calls `rateLimit("auth", "ip:…")` and
 * `rateLimit("auth", "identifier:…")` *before* it looks the user up, so the
 * limit trips on the identifier the caller just typed whether or not any
 * account has it. Its presence therefore says nothing about the account —
 * only that this caller has tried too often — while its absence from the
 * generic message would have left a locked-out operator staring at "check
 * your password" for fifteen minutes.
 *
 * Everything else — Postgres down, Redis rejecting a session write, a bug —
 * gets {@link SIGN_IN_UNAVAILABLE_MESSAGE}. That distinction leaks nothing
 * about any account and is the difference between "I typed it wrong" and
 * "the site is broken", which is precisely what the page failed to tell
 * anyone before this existed.
 */
import { isAppError, type AppError } from "@/lib/errors";

/**
 * Shown for every credential failure without exception: unknown identifier,
 * wrong password, suspended account, locked account. One string, one code
 * path, no parameters — so it cannot accidentally acquire a branch later.
 */
export const SIGN_IN_FAILED_MESSAGE =
  "That email or phone number and password didn't match. Check them and try again.";

/** Shown when `authorize()`'s per-IP or per-identifier limiter rejects. */
export const SIGN_IN_RATE_LIMITED_MESSAGE =
  "Too many sign-in attempts. For security, sign-in is paused for up to 15 minutes — please try again after that.";

/** Shown when sign-in failed for a reason that is nothing to do with the credentials. */
export const SIGN_IN_UNAVAILABLE_MESSAGE =
  "We couldn't complete sign-in just now. Please try again in a moment.";

/** `AuthError.type` for "authorize() returned null" — the credential-failure path. */
const CREDENTIALS_SIGNIN_TYPE = "CredentialsSignin";

/** Guard against a cyclic `cause` chain; nothing legitimate nests this deep. */
const MAX_CAUSE_DEPTH = 8;

/**
 * `AuthError.type` if `value` looks like one, otherwise null.
 *
 * Duck-typed rather than `instanceof AuthError` so this module stays free of
 * a `next-auth` import and therefore testable in a plain Node worker.
 */
export function authErrorType(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const { type } = value as { type?: unknown };
  return typeof type === "string" ? type : null;
}

/**
 * One step down the chain: `AuthError` stores its wrapped original at
 * `cause.err`, a plain `Error` stores its own at `cause`. Returns undefined
 * at the end of the chain.
 */
function unwrapCauseOnce(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const { cause } = value as { cause?: unknown };
  if (typeof cause !== "object" || cause === null) return cause ?? undefined;
  if ("err" in cause) return (cause as { err?: unknown }).err;
  return cause;
}

/**
 * The first `AppError` anywhere in `error`'s cause chain, or null. Exported
 * for its tests: the nesting above is exactly the sort of thing that breaks
 * silently when a dependency changes how it wraps.
 */
export function findAppErrorCause(error: unknown): AppError | null {
  let current: unknown = error;
  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (current === undefined || current === null) return null;
    if (isAppError(current)) return current;
    current = unwrapCauseOnce(current);
  }
  return null;
}

/**
 * The message to render for a failed `signIn`. Total: every input maps to
 * one of the three constants above, so the form can never end up with an
 * empty error region and no navigation — the exact failure this page shipped
 * with.
 */
export function signInFailureMessage(error: unknown): string {
  if (findAppErrorCause(error)?.code === "RATE_LIMITED") {
    return SIGN_IN_RATE_LIMITED_MESSAGE;
  }
  if (authErrorType(error) === CREDENTIALS_SIGNIN_TYPE) {
    return SIGN_IN_FAILED_MESSAGE;
  }
  return SIGN_IN_UNAVAILABLE_MESSAGE;
}
