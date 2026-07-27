/**
 * A minimal Result type for service functions that want to return a typed
 * failure without throwing (e.g. payment verification outcomes where the
 * caller must branch on every case). See docs/04-REPOSITORY-STRUCTURE.md.
 */

export type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(result: Result<T, E>): result is { ok: true; value: T } {
  return result.ok;
}

export function isErr<T, E>(result: Result<T, E>): result is { ok: false; error: E } {
  return !result.ok;
}

/** Unwraps a Result, throwing the error if it failed. Use only at a boundary that expects to throw. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value;
  throw result.error;
}
