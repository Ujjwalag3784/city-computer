// Prisma 7 config — replaces the `datasource.url` that used to live in the
// schema file. This is what the Prisma CLI (generate/migrate/studio/db seed)
// reads; it has no effect on the running Next.js app, which gets its own
// connection string through src/env.ts + the driver adapter in
// src/server/db.ts. See docs/17-ROADMAP-PHASES.md Phase 3 and
// https://www.prisma.io/docs/orm/reference/prisma-config-reference.
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig, env } from "prisma/config";

// The project's convention (see .env.example / README) is `.env.local`, not
// the plain `.env` Prisma's own docs default to — load that explicitly so
// this file works the same way `next dev` already does. Resolved against
// process.cwd() rather than __dirname/import.meta.url (this file runs as an
// ES module under package.json's "type": "module", so __dirname doesn't
// exist) — Prisma CLI commands are always run from the project root, where
// this file also lives, so cwd is the right anchor.
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });

export default defineConfig({
  // Multi-file schema — see docs/04-REPOSITORY-STRUCTURE.md §4.
  schema: "prisma/schema",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed/index.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
