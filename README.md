# City Computer Systems — `citycomputer`

Rebuild of https://citycomputer.com.np/. Full architecture is documented in
[`docs/`](./docs/00-MASTER-INDEX.md) — read `docs/00-MASTER-INDEX.md` first.

**Build status:** Phase 1 (Foundation & Tooling) in progress. See
`docs/17-ROADMAP-PHASES.md` for the full phase plan and
`docs/18-SONNET-HANDOFF.md` for the execution protocol this project follows.

## Setup

```bash
git clone <repo>
cd citycomputer
pnpm install
cp .env.example .env.local        # fill in real values later; defaults work for local dev
docker compose up -d              # postgres, redis, minio, meilisearch, mailpit
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open http://localhost:3000.

## Scripts

| Command                                                | Purpose                      |
| ------------------------------------------------------ | ---------------------------- |
| `pnpm dev`                                             | Start the Next.js dev server |
| `pnpm build` / `pnpm start`                            | Production build and serve   |
| `pnpm typecheck`                                       | `tsc --noEmit`               |
| `pnpm lint` / `pnpm lint:fix`                          | ESLint                       |
| `pnpm format` / `pnpm format:check`                    | Prettier                     |
| `pnpm test` / `pnpm test:watch` / `pnpm test:coverage` | Vitest                       |
| `pnpm db:generate`                                     | Generate the Prisma client   |
| `pnpm db:migrate`                                      | Run migrations (dev)         |
| `pnpm db:deploy`                                       | Run migrations (production)  |
| `pnpm db:seed`                                         | Seed the database            |
| `pnpm db:studio`                                       | Prisma Studio                |

## Architecture at a glance

```
Cloudflare (CDN + WAF)
        │
Next.js 15 (App Router) — storefront · checkout · admin · api
        │
Service layer (src/server/services/*)
        │
PostgreSQL 16 (Prisma) · Redis · S3-compatible storage · job queue
        │
eSewa · Khalti · Fonepay · connectIPS · Resend · GA4/GTM · Meta CAPI · Sentry
```

Full diagram and rationale: `docs/00-MASTER-INDEX.md §4`, `docs/03-TECHNOLOGY-STACK.md`.

## Repository layout

See `docs/04-REPOSITORY-STRUCTURE.md` for the complete, authoritative layout
and the module-boundary rules enforced by `eslint.config.mjs`.

## Conventions

- Money is always an integer number of paisa. Never a float. See `src/lib/money.ts`.
- All user-facing admin copy avoids developer jargon — see `docs/09-ADMIN-DAD-MODE.md §2`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org/), enforced by commitlint.
- One phase at a time, per `docs/17-ROADMAP-PHASES.md`. Do not start Phase N+1 before Phase N's acceptance criteria are met.

## Contributing

See `CONTRIBUTING.md` (added in Phase 1 completion) and `docs/15-DEVOPS-CICD.md §1`.

## One-time local git setup

This project was scaffolded and verified (typecheck, lint, tests, build,
coverage) from an automated build sandbox, which is not able to create a
`.git` repository directly on this Windows folder (Git needs to create and
delete lock files, which the sandbox's mount doesn't permit). Everything
else — every source file, config, and doc — is real and already on disk.

To turn this into a working local git repo with the pre-commit/commit-msg
hooks active, open a terminal **on your own machine** (PowerShell or the VS
Code terminal) in this folder and run:

```bash
git init
git branch -m main
pnpm install        # also runs `pnpm prepare` → installs husky hooks
git add -A
git commit -m "chore: initial commit"
```

After that, `pnpm dev`, `pnpm test`, `pnpm lint`, `pnpm build`, and the git
hooks all work exactly as documented above — this step only needs to run
once.
