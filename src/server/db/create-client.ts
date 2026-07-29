// The actual Prisma Client factory, split out of `src/server/db.ts` so it
// can be shared by two entry points with different guard requirements:
//
//   - `@/server/db` (../db.ts) — the app's singleton, guarded by
//     `import "server-only"`, imported by every Next.js server-side
//     service module.
//   - `@/server/db/seed-client` (./seed-client.ts) — unguarded, imported
//     only by `prisma/seed/*.ts`, which run via `tsx` outside Next's
//     bundler and crash if anything in their import chain pulls in the
//     real `server-only` package (see `src/env-core.ts`'s header comment
//     for the full explanation of why).
//
// This file itself is intentionally NOT a general-purpose import for app
// code — it exists only to be wrapped by the two files above. Application
// code should keep importing `db` from `@/server/db`, never from here
// directly, so the Client-Component guard stays meaningful.
//
// Because this file is the one place outside `db.ts` allowed to call `new
// PrismaClient(...)`, it's explicitly allow-listed alongside `db.ts` in
// eslint.config.mjs's `no-restricted-syntax` override.
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/env-core";
import { softDeleteExtension } from "./soft-delete-extension";

export function createPrismaClient() {
  // Prisma 7 requires a driver adapter for every database, including
  // plain self-hosted Postgres — there is no more URL-only client
  // construction (docs/03-TECHNOLOGY-STACK.md, Prisma's v7 upgrade guide).
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const client = new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  // Soft-delete read filtering (docs/06-DATA-MODEL.md §1) — see
  // ./soft-delete-extension.ts for what this does and why it is a
  // separate file. Applied here, once, in the one shared factory, so
  // every caller (the app singleton and the seed script client alike)
  // gets the filtering automatically instead of having to remember to
  // apply it themselves.
  return client.$extends(softDeleteExtension);
}

export type PrismaClientWithExtensions = ReturnType<typeof createPrismaClient>;
