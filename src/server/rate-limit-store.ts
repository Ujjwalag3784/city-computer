import "server-only";
import { kvIncrement } from "@/server/kv-store";
import type { RateLimitStore } from "@/lib/rate-limit";
import {
  checkRateLimit,
  rateLimitKey,
  RATE_LIMIT_PRESETS,
  type RateLimitPresetName,
} from "@/lib/rate-limit";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/** `lib/rate-limit.ts`'s `RateLimitStore`, backed by Postgres (see below). */
/**
 * Fixed-window counter in Postgres (`kv_entries`): one row per key per
 * window, incremented atomically. Slightly coarser than the old Redis
 * sliding window (a burst straddling a window edge can get up to 2x `max`),
 * which is fine for abuse-blunting.
 *
 * Fails OPEN on a database error: rate limiting is defence in depth, and
 * every authorisation control (session validity, admin role, 2FA gate)
 * still fails closed on its own.
 */
const postgresRateLimitStore: RateLimitStore = {
  async recordAndCount(key, nowMs, windowMs) {
    const windowIndex = Math.floor(nowMs / windowMs);
    try {
      return await kvIncrement(`${key}:${windowIndex}`, Math.ceil(windowMs / 1000));
    } catch (error) {
      logger.warn({ key, error }, "rate limit store: database unavailable, failing open");
      return 0;
    }
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
  const result = await checkRateLimit(postgresRateLimitStore, key, config);

  if (!result.allowed) {
    const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
    throw new AppError("RATE_LIMITED", "Too many attempts. Please try again later.", {
      detail: `Retry after ${retryAfterSeconds} seconds.`,
    });
  }
}
