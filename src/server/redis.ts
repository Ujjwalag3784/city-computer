import "server-only";
import { Redis } from "ioredis";
import { env } from "@/env";
import { logger } from "@/lib/logger";

/**
 * The single ioredis client singleton for the whole app — mirrors
 * `server/db.ts`'s reasoning: Next.js dev mode hot-reloads server modules on
 * every save, and a production server can evaluate this module once per
 * route bundle, either of which would otherwise open a fresh TCP connection
 * to Redis. Stashing the client on `globalThis` survives both.
 *
 * Used by: `server/rate-limit-store.ts` (sliding-window rate limiting,
 * docs/13-SECURITY.md §8, **fails open** — a dead Redis must never break the
 * storefront) and `server/auth/session-state.ts` (the 8h/30min admin session
 * windows and the 2FA flag, which **fail closed** — no Redis, no `/admin`,
 * deliberately, and — since the review of this change — as a redirect to
 * sign-in rather than the HTTP 500 the unguarded `await` in
 * `isAdminSessionWithinLimits` used to throw out of `middleware.ts`).
 * Never imported by `components/**` or `lib/**`.
 *
 * ── Tuned for serverless, after the first production deploy ──
 *
 * Vercel's runtime logs filled with `{"errorno":"ETIMEDOUT","code":
 * "ETIMEDOUT","syscall":"connect"} Redis client error` against an Upstash
 * `rediss://` endpoint. Four things about the original configuration made
 * that both more likely and much noisier than it needed to be, and all four
 * are fixed below. What is NOT the problem, checked rather than guessed at:
 *
 * - **TLS needs no extra options.** ioredis 5.11 parses a `rediss://` URL
 *   and defaults `tls: true` (`Redis.js`'s constructor), and its
 *   `StandaloneConnector` then calls `tls.connect({ host, port, family })`,
 *   which sets the SNI `servername` from `host` automatically. Upstash has
 *   TLS on for every database and cannot turn it off, so `rediss://` is
 *   exactly right and an explicit `tls: {}` would add nothing.
 * - **`family` is already dual-stack.** ioredis's default is `family: 0`
 *   (not 4), i.e. "let the OS pick", and Node 22 does Happy Eyeballs, so the
 *   classic "resolved to IPv6 with no IPv6 route" ETIMEDOUT is not in play.
 * - **`REDIS_URL` is definitely set on Vercel.** `env-core.ts` defaults it
 *   to `redis://localhost:6379`; connecting *there* from a serverless
 *   sandbox yields `ECONNREFUSED`, not `ETIMEDOUT`. The timeout means a real
 *   remote host is being dialled.
 *
 * 1. **`lazyConnect: true`.** The old client dialled Redis the moment this
 *    module was imported. That happens on *every* request path, because
 *    `middleware.ts` imports `session-state.ts` and the storefront's
 *    `_actions.ts` imports `rate-limit-store.ts` — so a storefront page
 *    view, which never issues a single Redis command, still opened a socket
 *    and still logged `ETIMEDOUT` when it failed. Worse, a serverless
 *    instance frozen after responding leaves that 10-second connect timer to
 *    fire on the next thaw, manufacturing timeouts out of nothing. Now
 *    nothing connects until something actually runs a command: the
 *    storefront never connects at all, and `/admin` connects on its first
 *    `session-state` read.
 * 2. **`commandTimeout`.** `maxRetriesPerRequest: 2` bounds *retries*, not
 *    wall-clock: with the offline queue on (which `lazyConnect` requires —
 *    ioredis rejects the very first command if `enableOfflineQueue` is
 *    false) a command against a dead Redis could sit queued through two
 *    connect timeouts. A per-command deadline is the right knob, and it is
 *    applied before the writability check, so it covers queued time too.
 *    `rate-limit-store.ts` turns that rejection into its documented
 *    fail-open in ~3s instead of ~30s.
 * 3. **`globalThis` reuse in production too.** Previously the singleton was
 *    only cached outside production, so any second evaluation of this module
 *    opened a second connection that nothing ever closed. Upstash caps
 *    concurrent connections and bills them; leaking them is how a
 *    working setup degrades into `ERR max concurrent connections exceeded`.
 * 4. **Throttled error logging.** `retryStrategy` reconnects forever by
 *    design (a Redis down for maintenance must recover without a redeploy),
 *    but the `error` handler logged every single attempt, which is what
 *    turned one unreachable host into a wall of identical log lines. The
 *    first error is logged immediately; after that, at most one line a
 *    minute, carrying the count it stands for.
 *
 * **If ETIMEDOUT persists after this**, the answer is not more ioredis
 * tuning: Upstash's own documentation recommends their HTTP client for this
 * platform ("It is HTTP-based, which makes it ideal for serverless
 * environments like Vercel… In highly concurrent serverless workloads,
 * TCP-based clients can run into connection issues"), and their Next.js App
 * Router quickstart uses only `@upstash/redis`. Switching means a new
 * dependency plus `UPSTASH_REDIS_REST_URL`/`UPSTASH_REDIS_REST_TOKEN` in
 * `env-core.ts`, and it would stop working against a plain local Redis
 * container, so it is a deliberate trade rather than a free win — see
 * PROGRESS.md.
 */

/** Long enough for a cross-region TLS handshake, short enough not to stall a request. */
const CONNECT_TIMEOUT_MS = 5_000;
/** Per-command deadline, including time spent in the offline queue. */
const COMMAND_TIMEOUT_MS = 3_000;
/** At most one `Redis client error` line per minute per process. */
const ERROR_LOG_INTERVAL_MS = 60_000;

function createRedisClient(): Redis {
  const client = new Redis(env.REDIS_URL, {
    // Nothing dials Redis on import; the first real command does. See (1).
    lazyConnect: true,
    // Rate-limit checks are on the hot path of every request; fail fast
    // rather than queuing commands indefinitely against a dead connection.
    maxRetriesPerRequest: 2,
    connectTimeout: CONNECT_TIMEOUT_MS,
    commandTimeout: COMMAND_TIMEOUT_MS,
    // TCP keepalive on an otherwise idle connection, so a long-lived
    // instance notices a socket a NAT/proxy hop has silently dropped instead
    // of writing into a half-open one.
    keepAlive: 30_000,
    // Reconnect with backoff instead of ioredis's default of retrying
    // forever every 50ms — a capped backoff still recovers automatically but
    // doesn't hammer a Redis that's down for maintenance.
    retryStrategy(times) {
      return Math.min(times * 500, 10_000);
    },
  });

  let suppressedSinceLastLog = 0;
  let lastLoggedAtMs = 0;
  client.on("error", (error: unknown) => {
    const nowMs = Date.now();
    if (lastLoggedAtMs !== 0 && nowMs - lastLoggedAtMs < ERROR_LOG_INTERVAL_MS) {
      suppressedSinceLastLog += 1;
      return;
    }
    logger.error(
      { error, suppressedSinceLastLog },
      "Redis client error (further identical errors are throttled to one a minute)",
    );
    lastLoggedAtMs = nowMs;
    suppressedSinceLastLog = 0;
  });

  return client;
}

declare global {
  // eslint-disable-next-line no-var
  var __redis: Redis | undefined;
}

export const redis: Redis = globalThis.__redis ?? createRedisClient();

// Cached in production too, not just in dev — see (3) above.
globalThis.__redis = redis;
