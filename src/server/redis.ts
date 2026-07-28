import "server-only";
import { Redis } from "ioredis";
import { env } from "@/env";
import { logger } from "@/lib/logger";

/**
 * The single ioredis client singleton for the whole app — mirrors
 * `server/db.ts`'s reasoning exactly: Next.js dev mode hot-reloads server
 * modules on every save, which would otherwise open a fresh TCP connection
 * to Redis on every edit. Stashing the client on `globalThis` survives
 * module reloads within the same Node process.
 *
 * Used by: `server/rate-limit-store.ts` (sliding-window auth/API rate
 * limiting, docs/13-SECURITY.md §8), and will later back the session-cache
 * and job-queue layers (docs/04-REPOSITORY-STRUCTURE.md `server/jobs/`).
 * Never imported by `components/**` or `lib/**` — only `server/**` talks to
 * Redis directly.
 */

function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    // Rate-limit checks are on the hot path of every request; fail fast
    // rather than queuing commands indefinitely against a dead connection.
    maxRetriesPerRequest: 2,
    // Reconnect with backoff instead of ioredis's default of retrying
    // forever with no cap — a capped backoff still recovers automatically
    // but doesn't hammer a Redis that's down for maintenance.
    retryStrategy(times) {
      return Math.min(times * 200, 2000);
    },
  });

  client.on("error", (error: unknown) => {
    logger.error({ error }, "Redis client error");
  });

  return client;
}

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

export const redis: Redis = globalThis.__redis ?? createRedisClient();

if (env.NODE_ENV !== "production") {
  globalThis.__redis = redis;
}
