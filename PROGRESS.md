# Progress

One place to check what's actually built versus what's still ahead. Updated
as each phase lands — see `docs/17-ROADMAP-PHASES.md` for the full plan this
tracks against.

## How to check this yourself

```bash
pnpm install
pnpm typecheck   # tsc --noEmit
pnpm lint        # eslint . --max-warnings=0
pnpm test:coverage
pnpm build       # next build
```

All four are already confirmed green in the environment this was built in
(see below for the one exception). Re-running them locally is the fastest
way to independently verify anything below rather than taking this file's
word for it.

## Phase 1 — Foundation & Tooling: done, verified

Next.js 15 + TypeScript strict + Zod-validated env (`src/env.ts`), the
pure-logic `src/lib/` modules (`money.ts` at 100% test coverage, `date.ts`,
`nepal.ts`, `ids.ts`, `slug.ts`, `errors.ts`, `result.ts`, `logger.ts`),
ESLint flat config with the module-boundary and security rules, Vitest,
Prettier, Docker Compose (Postgres/Redis/MinIO/Meilisearch/Mailpit), the
GitHub Actions CI pipeline, husky + lint-staged + commitlint, `CONTRIBUTING.md`,
`SECURITY.md`.

Verified: `pnpm typecheck`, `pnpm lint`, `pnpm test:coverage` (107/107
tests, `money.ts` 100%), `pnpm build` all pass. A bad commit message and a
lint violation were both confirmed to get blocked by the git hooks.

**Not yet done in this environment:** the actual `git init`/first commit —
see "One-time local git setup" in `README.md`. The files are real; the git
history just needs to be created on your machine.

## Phase 3 — Data Layer (schema/seed slice): done, _not yet tooling-verified_

`prisma/schema/*.prisma` — the full data model from `docs/06-DATA-MODEL.md`:
~75 models across `schema.prisma` (datasource + ~65 enums), `auth.prisma`,
`catalog.prisma`, `inventory.prisma`, `commerce.prisma`, `builder.prisma`,
`content.prisma`, `service.prisma`, `ops.prisma`.

`prisma/sql/manual-constraints.sql` — everything Prisma's schema DSL can't
express natively: `CHECK` constraints, the partial unique index for "one
default variant per product", the `tsvector` search columns + triggers, the
category-path ancestry trigger, and the `REVOKE UPDATE, DELETE` grants on
the append-only tables.

`src/server/db.ts` + `src/server/db/soft-delete-extension.ts` — the one
permitted `PrismaClient` singleton (now enforced by an ESLint rule), with a
read-filtering extension for the 8 soft-delete models.

`prisma/seed/{index,core,taxonomy,catalog,builder,content}.ts` — roles and
permissions, the branch and delivery zones, category tree, brands, all 15
spec templates, ~10 demo products, ~22 PC-builder parts with connectors and
5 compatibility rules, policy pages and menus. Seed volume is intentionally
reduced from the blueprint's suggested 20 products / 60 parts — flagged in
comments in those files as a follow-up before real QA.

**Important caveat:** `pnpm db:generate` / `pnpm db:migrate` have never
actually been run against this schema. The sandbox this was built in blocks
network access to Prisma's engine-binary CDN, so I could not verify the
schema compiles. Everything that _could_ be checked without that engine —
`pnpm lint` and `pnpm typecheck` on every new file — is clean; the only
typecheck errors present are "`@prisma/client` has no exported member X",
which is the exact, expected symptom of `generate` never having run, and
nothing else. **First thing to do locally:** `pnpm db:generate`, then
`docker compose up -d && pnpm db:migrate && pnpm db:seed`, and fix whatever
Prisma's own error messages point at if anything doesn't compile.

**Not done:** Auth.js v5 config, Argon2id password hashing, session
strategy, the `requirePermission()` RBAC layer, admin TOTP 2FA, auth rate
limiting, the registration/verification/login/reset flows, the account
shell, and the full authorisation-matrix test suite. All still open —
tracked as the rest of Phase 3.

## Phase 2 — Design System: not started

## Phase 4 onward: not started

Catalogue read path, cart/checkout, payments, PC builder engine, admin
console, content/SEO, analytics, testing/QA polish, performance, and launch
— per `docs/17-ROADMAP-PHASES.md`.
