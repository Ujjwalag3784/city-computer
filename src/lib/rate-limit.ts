/**
 * Pure sliding-window rate-limit algorithm — no Redis import here on
 * purpose. docs/04-REPOSITORY-STRUCTURE.md places this file under `lib/`
 * ("pure, dependency-light, isomorphic"), while the actual Redis-backed
 * store lives in `server/rate-limit-store.ts`. Splitting it this way means
 * the windowing logic itself — the part actually worth unit-testing — can
 * be tested with a trivial in-memory fake store, with no real Redis
 * connection required in CI or in this sandbox.
 *
 * The algorithm: a Redis sorted set per rate-limit key, scored by request
 * timestamp. Checking the limit means (1) dropping members older than the
 * window, (2) adding the current request, (3) counting what's left. A
 * `RateLimitStore` only has to expose that one composite operation — see
 * `server/rate-limit-store.ts` for the ioredis implementation.
 *
 * docs/13-SECURITY.md §8 / docs/07-API-DESIGN.md §2: "Redis sliding
 * window, keyed by IP + user + endpoint class."
 */

export interface RateLimitStore {
  /**
   * Records one request against `key` at time `nowMs`, evicts anything
   * older than `windowMs`, and returns the resulting count *including* the
   * request just recorded.
   */
  recordAndCount(key: string, nowMs: number, windowMs: number): Promise<number>;
}

export interface RateLimitConfig {
  /** Window length in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed inside the window (inclusive). */
  max: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Requests still available in the current window. Never negative. */
  remaining: number;
  /** Milliseconds until the caller should retry — only meaningful when `allowed` is false. */
  retryAfterMs: number;
  limit: number;
}

/**
 * docs/07-API-DESIGN.md §2's full table, keyed by the same short names used
 * at call sites (`checkRateLimit(store, "auth", identifier)`), so the
 * numbers live in exactly one place.
 */
export const RATE_LIMIT_PRESETS = {
  /** Login, register, password reset request — per docs/13 §2 "5 attempts / 15 min". */
  auth: { windowMs: 15 * 60 * 1000, max: 5 },
  /** Phone OTP request — docs/13 §2 "3 requests/hour/phone". */
  otpRequestPerPhone: { windowMs: 60 * 60 * 1000, max: 3 },
  /** Phone OTP request — docs/13 §2 "10/hour/IP". */
  otpRequestPerIp: { windowMs: 60 * 60 * 1000, max: 10 },
  /** Phone OTP verification attempts — docs/13 §2 "3 verification attempts". */
  otpVerify: { windowMs: 5 * 60 * 1000, max: 3 },
  cartMutation: { windowMs: 60 * 1000, max: 60 },
  checkoutPlace: { windowMs: 10 * 60 * 1000, max: 5 },
  /** Guest order-tracking phone-verification guesses — docs/07 §3.5's `POST /api/v1/track`: "Rate limited 10/hour/IP." */
  orderLookup: { windowMs: 60 * 60 * 1000, max: 10 },
  builderValidate: { windowMs: 60 * 1000, max: 120 },
  /** Media/receipt uploads — docs/13 §5 "20 uploads/hour/user". */
  upload: { windowMs: 60 * 60 * 1000, max: 20 },
  /** Public contact form (Phase 10) — same shape as `orderLookup`'s "guest-facing, anti-spam" reasoning, no doc-specified number, so a conservative one is chosen rather than left unlimited. */
  contactForm: { windowMs: 60 * 60 * 1000, max: 5 },
  /** Public newsletter signup (Phase 10) — same reasoning as `contactForm`. */
  newsletterSubscribe: { windowMs: 60 * 60 * 1000, max: 5 },
  /** Public repair-booking form (Phase 10) — same reasoning as `contactForm`. */
  serviceBooking: { windowMs: 60 * 60 * 1000, max: 5 },
  /** Public ticket-status lookup by ticket number + phone digits (Phase 10) — mirrors `orderLookup`'s "guest guesses" limit exactly, since it's the same enumeration-resistance shape (docs/07 §3.5). */
  ticketStatusLookup: { windowMs: 60 * 60 * 1000, max: 10 },
} as const satisfies Record<string, RateLimitConfig>;

export type RateLimitPresetName = keyof typeof RATE_LIMIT_PRESETS;

/**
 * Builds the Redis key for one rate-limit check. Deliberately namespaced
 * `ratelimit:{scope}:{identifier}` rather than a raw identifier, so a
 * customer's session ID and an IP address can never collide in the same
 * keyspace even if their string forms happened to match.
 */
export function rateLimitKey(scope: string, identifier: string): string {
  return `ratelimit:${scope}:${identifier}`;
}

/**
 * Checks (and records) one request against `config` using `store`. The
 * request is always recorded, even when it turns out to be over the limit
 * — an attacker retrying instantly should not get a free pass because the
 * previous attempt "didn't count".
 */
export async function checkRateLimit(
  store: RateLimitStore,
  key: string,
  config: RateLimitConfig,
  nowMs: number = Date.now(),
): Promise<RateLimitResult> {
  const count = await store.recordAndCount(key, nowMs, config.windowMs);
  const allowed = count <= config.max;
  return {
    allowed,
    remaining: Math.max(0, config.max - count),
    retryAfterMs: allowed ? 0 : config.windowMs,
    limit: config.max,
  };
}
