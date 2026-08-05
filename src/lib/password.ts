/**
 * Password hashing and policy, per docs/13-SECURITY.md §2:
 *   "Argon2id, memory ≥ 19 MiB, iterations ≥ 2, parallelism 1. Never
 *   bcrypt-by-default, never MD5/SHA."
 *   "≥ 10 characters. No composition rules... Checked against a
 *   breached-password corpus on set and change."
 *
 * `argon2` (node-argon2) is a native binding — this file is server-only in
 * practice (imported only from `server/services/auth/*`), but doesn't
 * import `server-only` itself because the pure `validatePasswordLength`/
 * `isPasswordBreached` shape is still worth keeping test-friendly and
 * import-cheap; the native module cost is paid once by whatever server
 * module actually calls `hashPassword`/`verifyPassword`.
 *
 * It is also imported by `prisma/seed/create-admin.ts`, which runs under
 * plain `tsx` rather than Next's bundler, so nothing this file imports may
 * pull in the `server-only` package either — that is why the two
 * `logger.warn` calls below come from `@/lib/logger-core` (the unguarded
 * Pino instance) rather than `@/lib/logger` (the guarded entry point app
 * code uses). Exactly the same reasoning as
 * `src/server/db/create-client.ts` importing `@/env-core` instead of
 * `@/env`; see `src/lib/logger-core.ts`'s header for the details.
 */
import argon2 from "argon2";
import { createHash } from "node:crypto";
import { logger } from "@/lib/logger-core";
import { ValidationError } from "@/lib/errors";

const MIN_PASSWORD_LENGTH = 10;

// docs/13 §2's floor, expressed in the units argon2's Node binding wants
// (KiB for memoryCost). 19 MiB * 1024 = 19456 KiB.
const ARGON2ID_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

/** Hashes a plaintext password with Argon2id at the docs/13 §2 floor. Never call this on anything already hashed. */
export async function hashPassword(plaintext: string): Promise<string> {
  return argon2.hash(plaintext, ARGON2ID_OPTIONS);
}

/**
 * Verifies a plaintext password against a stored Argon2id hash.
 * Returns `false` (never throws) for a malformed/legacy hash — a caller
 * comparing against `user.passwordHash` should treat "doesn't match" and
 * "isn't even a valid hash" identically, per docs/13 §2's enumeration
 * resistance requirement (never leak *why* a login failed).
 */
export async function verifyPassword(hash: string, plaintext: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plaintext);
  } catch (error) {
    logger.warn({ error }, "verifyPassword: hash could not be verified (malformed or unsupported)");
    return false;
  }
}

/**
 * A handful of the most-breached passwords, used only as an offline
 * fallback when the live breach-corpus check below can't be reached (see
 * `isPasswordBreached`) — this is deliberately tiny and is not a
 * substitute for that check, only a floor so registration never silently
 * skips breach-checking just because a network call failed.
 */
const OFFLINE_COMMON_PASSWORD_DENYLIST = new Set([
  "password123",
  "12345678910",
  "qwertyuiop",
  "1qaz2wsx3edc",
  "letmein123",
  "iloveyou123",
  "admin123456",
  "welcome12345",
  "password1234",
  "changeme123",
]);

/** Throws `ValidationError` if `password` fails the length policy. Composition rules are deliberately not checked — docs/13 §2 calls them counter-productive. */
export function assertPasswordLength(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(
      [
        {
          field: "password",
          code: "too_short",
          message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
        },
      ],
      "Password does not meet the minimum length requirement.",
    );
  }
}

/**
 * Checks `password` against the Have I Been Pwned "Pwned Passwords"
 * k-Anonymity range API — the standard way to check a breach corpus
 * without ever sending the actual password (or even the full hash) over
 * the network. Only the first 5 hex characters of the SHA-1 hash are sent;
 * the API returns every suffix sharing that prefix, and the match happens
 * locally.
 *
 * Fails open: if the request errors, times out, or the API is
 * unreachable (this sandbox's network policy blocks arbitrary hosts, and
 * a real deployment should not let a third-party outage block every
 * signup), this falls back to the tiny offline denylist above and logs a
 * warning rather than throwing. A production deployment with real network
 * access gets the full HIBP corpus; every environment still gets *some*
 * check.
 */
export async function isPasswordBreached(password: string): Promise<boolean> {
  const sha1 = createHash("sha1").update(password, "utf8").digest("hex").toUpperCase();
  const prefix = sha1.slice(0, 5);
  const suffix = sha1.slice(5);

  try {
    const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      headers: { "Add-Padding": "true" },
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      throw new Error(`Pwned Passwords API returned ${response.status}`);
    }

    const body = await response.text();
    return body.split("\n").some((line) => line.trim().toUpperCase().startsWith(suffix));
  } catch (error) {
    logger.warn(
      { error },
      "isPasswordBreached: breach-corpus API unreachable, using offline fallback list",
    );
    return OFFLINE_COMMON_PASSWORD_DENYLIST.has(password.toLowerCase());
  }
}

/**
 * The full docs/13 §2 password-policy check, run on set (registration) and
 * change (password change/reset). Throws `ValidationError` on any
 * violation; callers don't need to inspect a boolean.
 */
export async function assertPasswordPolicy(password: string): Promise<void> {
  assertPasswordLength(password);

  if (await isPasswordBreached(password)) {
    throw new ValidationError(
      [
        {
          field: "password",
          code: "breached",
          message: "This password has appeared in a data breach. Please choose a different one.",
        },
      ],
      "Password failed the breach-corpus check.",
    );
  }
}
