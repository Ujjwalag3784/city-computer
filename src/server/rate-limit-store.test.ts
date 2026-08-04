import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/**
 * These tests exist for one reason: to pin the fail-open behaviour of
 * `recordAndCount` when Redis is unreachable.
 *
 * A free/demo Vercel deployment can easily end up with `REDIS_URL` pointing
 * at nothing (`src/env-core.ts` defaults it to `redis://localhost:6379`, so
 * env validation passes and nothing is listening). Before the fix these
 * cover, ioredis's `maxRetriesPerRequest: 2` meant `pipeline.exec()`
 * *rejected* rather than resolving to `null`, and that rejection escaped
 * `rateLimit()` — breaking sign-in, add-to-cart, checkout and the contact
 * form outright instead of degrading the rate limiting alone.
 */
const exec = vi.fn();
const pipeline = {
  zremrangebyscore: vi.fn(),
  zadd: vi.fn(),
  zcard: vi.fn(),
  pexpire: vi.fn(),
  exec,
};

vi.mock("@/server/redis", () => ({ redis: { pipeline: () => pipeline } }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { rateLimit } = await import("./rate-limit-store");
const { logger } = await import("@/lib/logger");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rateLimit with an unreachable Redis", () => {
  it("fails open when the pipeline rejects, instead of propagating the connection error", async () => {
    exec.mockRejectedValue(new Error("Reached the max retries per request limit"));

    await expect(rateLimit("auth", "ip:1.2.3.4")).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });

  it("fails open when the pipeline resolves to null", async () => {
    exec.mockResolvedValue(null);

    await expect(rateLimit("auth", "ip:1.2.3.4")).resolves.toBeUndefined();
  });

  it("fails open when ZCARD itself errors inside an otherwise-successful pipeline", async () => {
    exec.mockResolvedValue([
      [null, 0],
      [null, 1],
      [new Error("ZCARD exploded"), null],
      [null, 1],
    ]);

    await expect(rateLimit("auth", "ip:1.2.3.4")).resolves.toBeUndefined();
  });
});

describe("rateLimit with a working Redis", () => {
  function pipelineResultWithCount(count: number) {
    return [
      [null, 0],
      [null, 1],
      [null, count],
      [null, 1],
    ];
  }

  it("allows a request inside the window's limit", async () => {
    // docs/13 §2: the `auth` preset is 5 attempts / 15 min.
    exec.mockResolvedValue(pipelineResultWithCount(5));

    await expect(rateLimit("auth", "ip:1.2.3.4")).resolves.toBeUndefined();
  });

  it("still blocks a request over the limit — the control is not weakened by the fail-open path", async () => {
    exec.mockResolvedValue(pipelineResultWithCount(6));

    await expect(rateLimit("auth", "ip:1.2.3.4")).rejects.toBeInstanceOf(AppError);
    await expect(rateLimit("auth", "ip:1.2.3.4")).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
  });
});
