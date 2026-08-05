/**
 * The ONLY module app code should import for logging, guarded so an
 * accidental import into a Client Component bundle fails loudly at build
 * time. The actual Pino instance lives in `./logger-core` (no guard), so
 * that `tsx`-run one-shot scripts — `pnpm db:seed` and
 * `pnpm db:create-admin`, which never go through Next.js's bundler and
 * therefore can't rely on `server-only`'s bundler-condition trick — can
 * reach the same logger without hitting the "This module cannot be
 * imported from a Client Component module" crash. See `./logger-core.ts`'s
 * and `src/env-core.ts`'s header comments for the full explanation.
 *
 * Structured JSON logging via Pino: docs/03-TECHNOLOGY-STACK.md §2 and
 * docs/13-SECURITY.md §9 (redaction of secrets and PII).
 */
import "server-only";

export { logger, childLogger } from "./logger-core";
