import "server-only";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/env";
import { softDeleteExtension } from "./db/soft-delete-extension";

/**
 * The single Prisma Client singleton for the whole app.
 *
 * docs/04-REPOSITORY-STRUCTURE.md §3: "Only server/db.ts may instantiate
 * PrismaClient" (enforced by a custom ESLint rule) — every service module
 * imports `db` (or the `prisma` alias) from here, never `new
 * PrismaClient()` itself.
 *
 * Global-caching pattern: Next.js dev mode hot-reloads server modules on
 * every save, which would otherwise construct a fresh PrismaClient (and a
 * fresh connection pool) on every edit and eventually exhaust Postgres's
 * connection limit. Stashing the client on `globalThis` survives module
 * reloads within the same Node process; production has exactly one
 * long-lived process per instance, so the cache is a no-op there.
 */

function createPrismaClient() {
  // Prisma 7 requires a driver adapter for every database, including
  // plain self-hosted Postgres — there is no more URL-only client
  // construction (docs/03-TECHNOLOGY-STACK.md, Prisma's v7 upgrade guide).
  const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
  const client = new PrismaClient({
    adapter,
    log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

  // Soft-delete read filtering (docs/06-DATA-MODEL.md §1) — see
  // src/server/db/soft-delete-extension.ts for what this does and why it
  // is a separate file. Applied here, once, to the one shared client, so
  // every caller gets the filtering automatically instead of having to
  // remember to apply it themselves.
  return client.$extends(softDeleteExtension);
}

type PrismaClientWithExtensions = ReturnType<typeof createPrismaClient>;

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClientWithExtensions | undefined;
}

/**
 * The extended Prisma Client singleton. Import this as `db` in every
 * server-side service module:
 *
 *   import { db } from "@/server/db";
 *   const products = await db.product.findMany();
 *
 * `prisma` is exported as an alias below purely for readability in files
 * that read more naturally as `prisma.order.create(...)` — both names
 * point at the exact same instance, so there is only ever one connection
 * pool regardless of which name a given file imports.
 */
export const db: PrismaClientWithExtensions = globalThis.__prisma ?? createPrismaClient();

if (env.NODE_ENV !== "production") {
  globalThis.__prisma = db;
}

export { db as prisma };
