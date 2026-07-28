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

    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, nowMs, member);
    pipeline.zcard(key);
    // Let Redis expire the whole key once the window has fully elapsed —
    // otherwise a key for a rate limit that's never hit again would live
    // forever.
    pipeline.pexpire(key, windowMs);
    const results = await pipeline.exec();

    if (!results) {
      // ioredis returns null only when the pipeline itself failed to
      // execute (e.g. connection down) — fail open rather than blocking
      // every request in the app because Redis is briefly unavailable.
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
