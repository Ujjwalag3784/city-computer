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
