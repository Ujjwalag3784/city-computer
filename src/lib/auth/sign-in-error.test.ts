/**
 * The classifier behind `/auth/login`'s error region.
 *
 * The fixtures below rebuild the exact shapes `@auth/core@0.41.x` produces,
 * because that wrapping — `AuthError`'s constructor putting the original at
 * `cause.err` rather than at `cause` — is the part most likely to change
 * under us, and the part that decides whether an operator sees "too many
 * attempts" or a useless generic string.
 */
import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/errors";
import {
  authErrorType,
  findAppErrorCause,
  signInFailureMessage,
  SIGN_IN_FAILED_MESSAGE,
  SIGN_IN_RATE_LIMITED_MESSAGE,
  SIGN_IN_UNAVAILABLE_MESSAGE,
} from "@/lib/auth/sign-in-error";

/**
 * Stands in for `@auth/core`'s `AuthError` subclasses. Mirrors the two
 * things this module actually reads: the `type` discriminator every
 * subclass sets from its static `type`, and the `{ err }` cause envelope the
 * base constructor builds when it is handed an Error.
 */
function authErrorLike(type: string, wrapped?: unknown): Error & { type: string } {
  const error = new Error(`${type}. Read more at https://errors.authjs.dev#${type.toLowerCase()}`, {
    cause: wrapped === undefined ? undefined : { err: wrapped },
  }) as Error & { type: string };
  error.type = type;
  return error;
}

/** What `authorize()` returning `null` looks like by the time the action catches it. */
const credentialsSignin = (): unknown => authErrorLike("CredentialsSignin");

/** What a throw from inside `authorize()` looks like: wrapped in CallbackRouteError. */
const callbackRouteError = (wrapped: unknown): unknown =>
  authErrorLike("CallbackRouteError", wrapped);

const rateLimited = (): AppError =>
  new AppError("RATE_LIMITED", "Too many attempts. Please try again later.", {
    detail: "Retry after 900 seconds.",
  });

describe("authErrorType", () => {
  it("reads the discriminator off an AuthError-shaped object", () => {
    expect(authErrorType(credentialsSignin())).toBe("CredentialsSignin");
  });

  it("returns null for anything that is not AuthError-shaped", () => {
    expect(authErrorType(new Error("plain"))).toBeNull();
    expect(authErrorType(null)).toBeNull();
    expect(authErrorType(undefined)).toBeNull();
    expect(authErrorType("CredentialsSignin")).toBeNull();
    expect(authErrorType({ type: 42 })).toBeNull();
  });
});

describe("findAppErrorCause", () => {
  it("finds an AppError thrown directly", () => {
    const error = rateLimited();
    expect(findAppErrorCause(error)).toBe(error);
  });

  it("finds an AppError through AuthError's `{ err }` cause envelope", () => {
    const appError = rateLimited();
    expect(findAppErrorCause(callbackRouteError(appError))).toBe(appError);
  });

  it("finds an AppError through a plain Error's `cause`", () => {
    const appError = rateLimited();
    expect(findAppErrorCause(new Error("outer", { cause: appError }))).toBe(appError);
  });

  it("finds an AppError nested two wrappers deep", () => {
    const appError = rateLimited();
    const inner = new Error("prisma exploded", { cause: appError });
    expect(findAppErrorCause(callbackRouteError(inner))).toBe(appError);
  });

  it("returns null when there is no AppError anywhere in the chain", () => {
    expect(findAppErrorCause(credentialsSignin())).toBeNull();
    expect(findAppErrorCause(new Error("nope"))).toBeNull();
    expect(findAppErrorCause(undefined)).toBeNull();
  });

  it("terminates on a self-referential cause chain rather than hanging", () => {
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    expect(findAppErrorCause(cyclic)).toBeNull();
  });
});

describe("signInFailureMessage", () => {
  it("shows the generic message when authorize() returned null", () => {
    // Every credential failure lands here: unknown identifier, wrong
    // password, suspended account, locked account. There is intentionally no
    // input to this function that separates them.
    expect(signInFailureMessage(credentialsSignin())).toBe(SIGN_IN_FAILED_MESSAGE);
  });

  it("shows the rate-limit message when the limiter rejected", () => {
    expect(signInFailureMessage(callbackRouteError(rateLimited()))).toBe(
      SIGN_IN_RATE_LIMITED_MESSAGE,
    );
  });

  it("prefers the rate-limit message even if the wrapper says CredentialsSignin", () => {
    const wrapped = authErrorLike("CredentialsSignin", rateLimited());
    expect(signInFailureMessage(wrapped)).toBe(SIGN_IN_RATE_LIMITED_MESSAGE);
  });

  it("shows the unavailable message for an infrastructure failure", () => {
    const dbDown = new Error("Can't reach database server at db:5432");
    expect(signInFailureMessage(callbackRouteError(dbDown))).toBe(SIGN_IN_UNAVAILABLE_MESSAGE);
  });

  it("shows the unavailable message for a non-rate-limit AppError", () => {
    const other = new AppError("DEPENDENCY_UNAVAILABLE", "Redis is down");
    expect(signInFailureMessage(callbackRouteError(other))).toBe(SIGN_IN_UNAVAILABLE_MESSAGE);
  });

  it("never returns an empty string, whatever it is handed", () => {
    // The bug this page shipped with was an outcome with no message at all,
    // so totality is the property that actually matters here.
    const inputs: unknown[] = [
      undefined,
      null,
      "",
      0,
      new Error(""),
      {},
      credentialsSignin(),
      callbackRouteError(rateLimited()),
      callbackRouteError(new Error("boom")),
    ];
    for (const input of inputs) {
      expect(signInFailureMessage(input).length).toBeGreaterThan(0);
    }
  });

  it("never mentions the account, the email, or the lock state", () => {
    // A regression guard on docs/13 §2's enumeration resistance: if someone
    // later "helpfully" adds a locked-account branch, this fails.
    const forbidden = ["locked", "suspended", "no such", "not found", "exist", "disabled"];
    const messages = [
      SIGN_IN_FAILED_MESSAGE,
      SIGN_IN_RATE_LIMITED_MESSAGE,
      SIGN_IN_UNAVAILABLE_MESSAGE,
    ];
    for (const message of messages) {
      for (const word of forbidden) {
        expect(message.toLowerCase()).not.toContain(word);
      }
    }
  });
});
