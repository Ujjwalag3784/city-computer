import "server-only";
import { redis } from "@/server/redis";
import type { RateLimitStore } from "@/lib/rate-limit";
import {
  checkRateLimit,
  rateLimitKey,
  RATE_LIMIT_PRESETS,
  type RateLimitPresetName,
} from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * The Redis-backed implementation of `lib/rate-limit.ts`'s `RateLimitStore`
 * interface — a sorted set per key, scored by request timestamp.
 *
 * Not a Lua script: `zremrangebyscore` + `zadd` + `zcard` + `pexpire` are
 * pipelined (one round trip) rather than wrapped in a single atomic script.
 * Under concurrent requests against the *same* key within the same
 * millisecond this can very rarely admit one request over the limit — an
 * acceptable trade for a security control whose job is blunting brute
 * force and abuse, not enforcing an exact quota. A Lua `EVAL` would close
 * that gap if it ever proves necessary in practice.
 */
const redisRateLimitStore: RateLimitStore = {
  async recordAndCount(key, nowMs, windowMs) {
    const windowStart = nowMs - windowMs;
    // The member must be unique per request or concurrent requests in the
    // same millisecond would collide in the sorted set and undercount.
    const member = `${nowMs}-${Math.random().toString(36).slice(2)}`;

    let results: Awaited<ReturnType<ReturnType<typeof redis.pipeline>["exec"]>>;
    try {
      const pipeline = redis.pipeline();
      pipeline.zremrangebyscore(key, 0, windowStart);
      pipeline.zadd(key, nowMs, member);
      pipeline.zcard(key);
      // Let Redis expire the whole key once the window has fully elapsed —
      // otherwise a key for a rate limit that's never hit again would live
      // forever.
      pipeline.pexpire(key, windowMs);
      results = await pipeline.exec();
    } catch (error) {
      // ioredis does NOT always resolve to `null` when Redis is
      // unreachable — with `maxRetriesPerRequest: 2` (server/redis.ts) it
      // *rejects* queued commands once that retry budget is spent, and a
      // rejecting `exec()` propagated straight out of here, past
      // `checkRateLimit`, past `rateLimit()`, and into whatever called it.
      // In practice that meant a dead or misconfigured Redis turned every
      // rate-limited entry point into a hard failure rather than a degraded
      // one: no sign-in (config.ts's `authorize` rate-limits before it even
      // looks up the user), no add-to-cart, no checkout, no contact form.
      // That directly contradicted this store's own documented intent one
      // branch below ("fail open rather than blocking every request in the
      // app because Redis is briefly unavailable"), which only ever covered
      // the `null` case.
      //
      // Failing open here is the correct call and not a weakened control:
      // rate limiting is abuse-blunting defence in depth, and every
      // *authorisation* control (session validity, admin role, the 2FA
      // gate in `session-state.ts`) still fails CLOSED independently — none
      // of them route through this file.
      logger.warn({ key, error }, "rate limit store: redis unreachable, failing open");
      return 0;
    }

    if (!results) {
      // The other half of the same story: ioredis returns null when the
      // pipeline never executed at all. Same fail-open reasoning.
      logger.warn({ key }, "rate limit store: pipeline returned no results, failing open");
      return 0;
    }

    const zcardResult = results[2];
    if (!zcardResult || zcardResult[0]) {
      logger.warn({ key, error: zcardResult?.[0] }, "rate limit store: ZCARD failed, failing open");
      return 0;
    }

    return typeof zcardResult[1] === "number" ? zcardResult[1] : 0;
  },
};

/**
 * The one function call sites actually use: `rateLimit("auth", ip)`.
 * Throws `AppError("RATE_LIMITED", ...)` with a `Retry-After`-friendly
 * detail when the limit is exceeded — callers don't need to know the
 * sliding-window mechanics, just that the promise rejects when they should
 * stop.
 */
export async function rateLimit(preset: RateLimitPresetName, identifier: string): Promise<void> {
  // `preset` is narrowed to the closed `RateLimitPresetName` union derived
  // from `RATE_LIMIT_PRESETS`'s own keys, never arbitrary user input.
  // eslint-disable-next-line security/detect-object-injection
  const config = RATE_LIMIT_PRESETS[preset];
  const key = rateLimitKey(preset, identifier);
  const result = await checkRateLimit(redisRateLimitStore, key, config);

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
    throw new AppError("RATE_LIMITED", "Too many attempts. Please try again later.", {
      detail: `Retry after ${retryAfterSeconds} seconds.`,
    });
  }
}
