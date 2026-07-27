# Contributing

This project follows the phase plan in `docs/17-ROADMAP-PHASES.md`. Please read
`docs/00-MASTER-INDEX.md` before making structural changes.

## Setup

```bash
pnpm install
cp .env.example .env.local
docker compose up -d
pnpm db:generate && pnpm db:migrate && pnpm db:seed
pnpm dev
```

## Workflow

1. One phase at a time. Do not start Phase N+1 before Phase N's acceptance
   criteria (listed in `docs/17-ROADMAP-PHASES.md`) are met.
2. Respect the module boundaries in `docs/04-REPOSITORY-STRUCTURE.md §3`
   (enforced by `eslint.config.mjs` — `lib/** ` cannot import `server/**`,
   `app/**`, or `components/**`; `components/**` cannot import `server/**`).
3. Money is always an integer number of paisa (`src/lib/money.ts`). Never a
   float. Format only at the presentation edge with `formatNPR()`.
4. All `process.env` access goes through `src/env.ts`. No other file may
   read `process.env` directly (the one narrow exception is
   `vitest.setup.ts`, which seeds test-only defaults).
5. Every new module under `src/lib/**` should have a co-located
   `*.test.ts`. `src/lib/money.ts` is pinned at 100% coverage
   (`vitest.config.ts`) — do not lower that threshold.

## Before opening a PR

```bash
pnpm typecheck
pnpm lint
pnpm test:coverage
pnpm build
```

All four must pass locally — they are exactly what CI runs
(`.github/workflows/ci.yml`).

## Commits

[Conventional Commits](https://www.conventionalcommits.org/), enforced by
commitlint via the `commit-msg` hook: `feat:`, `fix:`, `chore:`, `docs:`,
`refactor:`, `test:`, `ci:`. Example: `feat(cart): add coupon validation`.

A pre-commit hook runs `lint-staged` (ESLint + Prettier on staged files).
Both hooks are installed automatically by `pnpm install` (via `husky`).

## Admin ("Dad Mode") copy

Any user-facing string in `src/app/(admin)/**` must avoid developer jargon —
see `docs/09-ADMIN-DAD-MODE.md §2`. When in doubt, write it the way you'd
explain it to someone who has never used an admin panel before.
