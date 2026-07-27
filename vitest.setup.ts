// Test-only environment defaults so that modules importing `@/env` (e.g.
// `src/lib/logger.ts`) can load without a real `.env.local`. This file is
// the one other place (besides `src/env.ts`) allowed to touch `process.env`
// directly — see the `vitest.setup.ts` override in `eslint.config.mjs`.
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/citycomputer_test";
process.env.AUTH_SECRET ??= "test-secret-not-for-production-use-only-in-vitest";
