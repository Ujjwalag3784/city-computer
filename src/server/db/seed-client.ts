// A separate, UNGUARDED Prisma client for one-shot Node scripts
// (`prisma/seed/*.ts`, run via `tsx prisma/seed/index.ts` per
// `pnpm db:seed`). Deliberately does not import `@/server/db` or `@/env`
// — both carry `import "server-only"`, which only resolves safely under
// Next.js's own bundler. Run outside that bundler (plain `tsx`/Node,
// exactly how every seed script runs), `server-only` throws "This module
// cannot be imported from a Client Component module" unconditionally,
// crashing `pnpm db:seed` before it ever touches the database. See
// `src/env-core.ts`'s header comment for the full explanation.
//
// This client is intentionally NOT the app singleton: a seed script is a
// short-lived process that runs once and exits, so there's no dev-mode
// hot-reload connection-pool concern to guard against with the
// `globalThis` caching `src/server/db.ts` uses — a fresh client per
// script run is correct and simpler. It shares the exact same adapter +
// soft-delete-extension setup via `./create-client`, so seeded data is
// read back through identical Prisma behaviour either way.
//
// App code (anything under src/app, src/components, src/server/services)
// must keep importing `db` from `@/server/db`, never from here.
import { createPrismaClient } from "./create-client";

export const db = createPrismaClient();
export { db as prisma };
