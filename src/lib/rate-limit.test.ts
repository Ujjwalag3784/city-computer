import { describe, expect, it } from "vitest";
import {
  checkRateLimit,
  rateLimitKey,
  RATE_LIMIT_PRESETS,
  type RateLimitStore,
} from "./rate-limit";

/** A trivial in-memory store — exactly the kind of fake `lib/rate-limit.ts`'s split from the Redis implementation is meant to make possible. */
function createFakeStore(): RateLimitStore {
  const requests = new Map<string, number[]>();
  return {
    async recordAndCount(key, nowMs, windowMs) {
      const windowStart = nowMs - windowMs;
      const existing = requests.get(key) ?? [];
      const withinWindow = existing.filter((timestamp) => timestamp > windowStart);
      withinWindow.push(nowMs);
      requests.set(key, withinWindow);
      return withinWindow.length;
    },
  };
}

describe("rateLimitKey", () => {
  it("namespaces scope and identifier so they can never collide across scopes", () => {
    expect(rateLimitKey("auth", "1.2.3.4")).toBe("ratelimit:auth:1.2.3.4");
    expect(rateLimitKey("checkoutPlace", "1.2.3.4")).not.toBe(rateLimitKey("auth", "1.2.3.4"));
  });
});

describe("checkRateLimit", () => {
  it("allows requests up to the configured max", async () => {
    const store = createFakeStore();
    const config = { windowMs: 1000, max: 3 };
    const key = "test:allow";

    const results = await Promise.all(
      [0, 1, 2].map((i) => checkRateLimit(store, key, config, 100 + i)),
    );
    for (const result of results) {
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks the request that exceeds the max, and still records it", async () => {
    const store = createFakeStore();
    const config = { windowMs: 1000, max: 2 };
    const key = "test:block";

    await checkRateLimit(store, key, config, 100);
    await checkRateLimit(store, key, config, 200);
    const third = await checkRateLimit(store, key, config, 300);

    expect(third.allowed).toBe(false);
    expect(third.remaining).toBe(0);
    expect(third.retryAfterMs).toBe(config.windowMs);
  });

  it("lets a new request through once the window has fully elapsed", async () => {
    const store = createFakeStore();
    const config = { windowMs: 1000, max: 1 };
    const key = "test:window-reset";

    await checkRateLimit(store, key, config, 0);
    const stillBlocked = await checkRateLimit(store, key, config, 500);
    const afterWindow = await checkRateLimit(store, key, config, 1600);

    expect(stillBlocked.allowed).toBe(false);
    expect(afterWindow.allowed).toBe(true);
  });

  it("computes remaining correctly as requests accumulate", async () => {
    const store = createFakeStore();
    const config = { windowMs: 1000, max: 5 };
    const key = "test:remaining";

    const first = await checkRateLimit(store, key, config, 0);
    const second = await checkRateLimit(store, key, config, 10);

    expect(first.remaining).toBe(4);
    expect(second.remaining).toBe(3);
  });
});

describe("RATE_LIMIT_PRESETS", () => {
  it("matches docs/13-SECURITY.md §2's auth brute-force limit (5 attempts / 15 min)", () => {
    expect(RATE_LIMIT_PRESETS.auth).toEqual({ windowMs: 15 * 60 * 1000, max: 5 });
  });

  it("matches docs/13-SECURITY.md §5's upload limit (20/hour/user)", () => {
    expect(RATE_LIMIT_PRESETS.upload).toEqual({ windowMs: 60 * 60 * 1000, max: 20 });
  });
});
