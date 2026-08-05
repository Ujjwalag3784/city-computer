/**
 * The Pino instance behind `@/lib/logger`, deliberately split into its own
 * file with NO `import "server-only"` guard — the same two-entry-point
 * split `src/env-core.ts`/`src/env.ts` and
 * `src/server/db/create-client.ts`/`src/server/db/seed-client.ts` already
 * use, for the same reason.
 *
 * Why this file exists: `@/lib/logger` used to be a single file that
 * imported `@/env`, which carries `import "server-only"`. That guard only
 * resolves safely under Next.js's bundler; under plain Node/tsx the
 * `server-only` package throws unconditionally ("This module cannot be
 * imported from a Client Component module"). See `src/env-core.ts`'s
 * header comment for the full explanation. That made every `tsx`-run
 * one-shot script crash the moment anything in its import chain reached
 * the logger — which is exactly how `pnpm db:create-admin` broke
 * (`prisma/seed/create-admin.ts` -> `@/lib/password` -> `@/lib/logger` ->
 * `@/env` -> `server-only`), while `pnpm db:seed` stayed fine only because
 * its chain never happens to touch the logger.
 *
 * So the pino instance moved here, reading `LOG_LEVEL` from `@/env-core`
 * (the unguarded validation core) instead of `@/env`, and `./logger.ts`
 * became a thin re-export behind its own `import "server-only"`. Every
 * ordinary app import of `@/lib/logger` is therefore exactly as protected
 * as before; only the two script-reachable call sites in
 * `@/lib/password` import this file directly, the same way
 * `create-client.ts` imports `@/env-core` rather than `@/env`.
 *
 * This file is NOT a general-purpose replacement for `@/lib/logger`.
 * Application code (src/app, src/components, src/server/services) must
 * keep importing `logger`/`childLogger` from `@/lib/logger` so the
 * Client-Component guard stays meaningful. Because this file carries no
 * guard of its own, `src/lib/client-boundary.test.ts` lists it (alongside
 * `pino` and `@/env-core`) as a server-side-only module, so a Client
 * Component that reaches it still fails a test rather than silently
 * shipping pino and the whole env schema to the browser.
 *
 * See docs/03-TECHNOLOGY-STACK.md §2 and docs/13-SECURITY.md §9
 * (redaction of secrets and PII).
 */
import pino from "pino";
import { env } from "@/env-core";

const REDACT_PATHS = [
  "password",
  "*.password",
  "passwordHash",
  "*.passwordHash",
  "token",
  "*.token",
  "secret",
  "*.secret",
  "signature",
  "*.signature",
  "authorization",
  "*.authorization",
  "cookie",
  "*.cookie",
  "otp",
  "*.otp",
  "pidx",
  "*.pidx",
  "req.headers.authorization",
  "req.headers.cookie",
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: "[redacted]" },
  base: { service: "citycomputer" },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function childLogger(bindings: Record<string, unknown>) {
  return logger.child(bindings);
}
