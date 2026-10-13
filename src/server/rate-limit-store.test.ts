import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";

/**
 * Pins the rate limiter's behaviour on top of the Postgres counter: it
 * blocks once the window's count passes the preset's max, and it fails
 * OPEN (never blocks sign-in, cart or checkout) when the database errors.
 */
const kvIncrement = vi.fn();
vi.mock("@/server/kv-store", () => ({ kvIncrement }));
vi.mock("@/lib/logger", () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const { rateLimit } = await import("./rate-limit-store");
const { logger } = await import("@/lib/logger");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rateLimit", () => {
  it("allows requests under the limit", async () => {
    kvIncrement.mockResolvedValue(1);
    await expect(rateLimit("auth", "ip:1.2.3.4")).resolves.toBeUndefined();
  });

  it("throws RATE_LIMITED once the window's count passes the limit", async () => {
    kvIncrement.mockResolvedValue(10_000);
    await expect(rateLimit("auth", "ip:1.2.3.4")).rejects.toBeInstanceOf(AppError);
  });

  it("counts per key and per window", async () => {
    kvIncrement.mockResolvedValue(1);
    await rateLimit("auth", "ip:1.2.3.4");
    const [key, ttl] = kvIncrement.mock.calls[0]!;
    expect(key).toMatch(/ip:1\.2\.3\.4:\d+$/);
    expect(ttl).toBeGreaterThan(0);
  });

  it("fails open when the database is unavailable", async () => {
    kvIncrement.mockRejectedValue(new Error("connection refused"));
    await expect(rateLimit("auth", "ip:1.2.3.4")).resolves.toBeUndefined();
    expect(logger.warn).toHaveBeenCalled();
  });
});
